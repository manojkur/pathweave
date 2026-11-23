import copy
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import auth, content, library, problems, provider, store, worker


@asynccontextmanager
async def lifespan(app):
    store.init()
    if store.get("snapshot") is None:
        initial = content.initial_snapshot()
        store.put("snapshot", initial)
        store.put("release:" + initial["version"], initial)
    yield


app = FastAPI(title="Pathweave", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
STATIC = Path(__file__).parent / "static"


@app.middleware("http")
async def security(request, call_next):
    length = request.headers.get("content-length", "0")
    if length.isdigit() and int(length) > 100_000:
        return JSONResponse({"detail": "Request too large"}, status_code=413)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "microphone=(self), camera=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    )
    return response


class Login(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=256)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "pathweave",
        "version": "0.1.0",
        "git_sha": os.environ.get("GIT_SHA", "development"),
    }


@app.post("/api/auth/login")
def login(data: Login, request: Request):
    token, csrf = auth.authenticate(request, data.username, data.password)
    response = JSONResponse({"username": os.environ["OWNER_USERNAME"], "csrf": csrf})
    response.set_cookie(
        auth.COOKIE,
        token,
        httponly=True,
        samesite="strict",
        max_age=43200,
        secure=os.environ.get("APP_ORIGIN", "").startswith("https://"),
        path=os.environ.get("BASE_PATH", "") or "/",
    )
    return response


@app.get("/api/auth/session")
def session(owner=Depends(auth.require_owner)):
    return {"username": os.environ.get("OWNER_USERNAME"), "csrf": owner["csrf"]}


@app.post("/api/auth/logout")
def logout(owner=Depends(auth.require_owner)):
    with store.db() as con:
        con.execute("DELETE FROM sessions WHERE token=?", (owner["token"],))
    response = JSONResponse({"ok": True})
    response.delete_cookie(auth.COOKIE, path=os.environ.get("BASE_PATH", "") or "/")
    return response


@app.get("/api/state", dependencies=[Depends(auth.require_owner)])
def state():
    with store.db() as con:
        jobs = [dict(row) for row in con.execute("SELECT * FROM jobs")]
        proposals = [
            {**dict(row), "payload": json.loads(row["payload"])}
            for row in con.execute("SELECT * FROM proposals ORDER BY created DESC LIMIT 20")
        ]
    return {
        "catalog": worker.current(),
        "profile": store.get(
            "profile", {"skills": {}, "research_consent": False, "retain_conversations": False}
        ),
        "sources": content.read("sources.json"),
        "famous_problems": content.read("famous_problems.json"),
        "jobs": jobs,
        "proposals": proposals,
        "experiment": store.get("experiment"),
        "research_inbox": store.get("research_inbox", []),
        "provider_configured": provider.configured(),
        "provider_model": provider.settings()["model"],
        "provider_backend": provider.settings()["backend"],
        "local_ai_configured": bool(provider.settings()["local_url"]),
        "local_ai_model": provider.settings()["local_model"],
        "library_connected": bool(library.config()),
        "worker_alive": time.time() - store.get("worker_heartbeat", 0) < 180,
        "links": {
            "host": os.environ.get("HOST_URL", ""),
            "library": os.environ.get("LIBRARY_WEB_URL", ""),
            "library_label": os.environ.get("LIBRARY_LABEL", "Source library"),
        },
    }


class Preferences(BaseModel):
    goal: str = "ode-growth"
    strategy: str = "connected"
    research_consent: bool = False
    retain_conversations: bool = False


class ProviderConfig(BaseModel):
    key: str = Field(min_length=16, max_length=300)
    model: str = Field(min_length=3, max_length=200)


class BackendChoice(BaseModel):
    backend: str = Field(max_length=20)
    model: str = Field(default="", max_length=200)


@app.post("/api/provider/backend", dependencies=[Depends(auth.require_owner)])
async def select_backend(data: BackendChoice):
    try:
        await provider.select_backend(data.backend, data.model)
    except (httpx.HTTPError, provider.ProviderUnavailable, KeyError, ValueError) as exc:
        raise HTTPException(
            503,
            "The requested backend is not ready. Reconnect the local machine and confirm its served model before switching.",
        ) from exc
    return {"backend": provider.settings()["backend"]}


class PasswordChange(BaseModel):
    current: str = Field(max_length=256)
    new: str = Field(min_length=16, max_length=256)


@app.post("/api/auth/password", dependencies=[Depends(auth.require_owner)])
def change_password(data: PasswordChange):
    if not auth.password_matches(data.current, auth.configured_hash()):
        raise HTTPException(400, "The current password did not match")
    with store.db() as con:
        con.execute(
            "INSERT OR REPLACE INTO kv VALUES ('owner_password_hash',?)",
            (json.dumps(auth.password_hash(data.new)),),
        )
        con.execute("DELETE FROM sessions")
    response = JSONResponse({"ok": True})
    response.delete_cookie(auth.COOKIE, path=os.environ.get("BASE_PATH", "") or "/")
    return response


@app.post("/api/provider", dependencies=[Depends(auth.require_owner)])
async def configure_provider(data: ProviderConfig):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            key_response = await client.get(
                "https://openrouter.ai/api/v1/key", headers={"Authorization": "Bearer " + data.key}
            )
            key_response.raise_for_status()
            response = await client.get("https://openrouter.ai/api/v1/models")
            response.raise_for_status()
            if not any(m["id"] == data.model for m in response.json()["data"]):
                raise HTTPException(400, "Choose a model from the current provider catalog")
    except httpx.HTTPError as exc:
        raise HTTPException(
            400, "The provider could not verify this key; check its status in your provider account"
        ) from exc
    provider.save_settings(data.key, data.model)
    with store.db() as con:
        con.execute("UPDATE jobs SET next_run=0 WHERE role='narrative' AND status!='running'")
    return {"configured": True, "model": data.model}


@app.delete("/api/provider", dependencies=[Depends(auth.require_owner)])
def remove_provider():
    (store.directory() / "provider.json").unlink(missing_ok=True)
    return {"configured": provider.configured()}


@app.post("/api/profile", dependencies=[Depends(auth.require_owner)])
def preferences(data: Preferences):
    if data.goal not in {n["id"] for n in worker.current()["concepts"]} or data.strategy not in {
        "connected",
        "proof-first",
    }:
        raise HTTPException(400, "Unknown goal or strategy")
    profile = store.get("profile", {"skills": {}})
    profile.update(data.model_dump())
    store.put("profile", profile)
    if not data.retain_conversations:
        with store.db() as con:
            con.execute("DELETE FROM events WHERE kind='conversation'")
    return profile


@app.get("/api/pathway", dependencies=[Depends(auth.require_owner)])
def path(goal: str = "ode-growth", strategy: str = "connected"):
    try:
        return content.pathway(worker.current(), goal, store.get("profile", {}), strategy)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/problem", dependencies=[Depends(auth.require_owner)])
def problem(concept: str = "algebra", dimension: str = "intuition"):
    if dimension not in content.DIMENSIONS:
        raise HTTPException(400, "Unknown evidence dimension")
    key = uuid.uuid4().hex
    try:
        task = problems.make_problem(concept, key, dimension)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    with store.db() as con:
        con.execute("DELETE FROM attempts WHERE created<?", (time.time() - 86400 * 30,))
        con.execute(
            "INSERT INTO attempts(id,concept,dimension,payload,created) VALUES (?,?,?,?,?)",
            (key, concept, dimension, json.dumps(task), time.time()),
        )
    return {"id": key, **{k: v for k, v in task.items() if k not in {"answer", "reason"}}}


class Answer(BaseModel):
    id: str = Field(max_length=64)
    answer: str = Field(max_length=12000)
    assisted: bool = False


@app.post("/api/answer", dependencies=[Depends(auth.require_owner)])
def answer(data: Answer):
    with store.db() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT * FROM attempts WHERE id=?", (data.id,)).fetchone()
        if row is None or row["answered"]:
            raise HTTPException(409, "This task is unavailable or already recorded")
        task = json.loads(row["payload"])
        con.execute("UPDATE attempts SET answered=1 WHERE id=?", (data.id,))
        if task["kind"] == "proof":
            con.execute(
                "INSERT INTO events(kind,payload,created) VALUES (?,?,?)",
                (
                    "proof-submission",
                    json.dumps(
                        {
                            "concept": row["concept"],
                            "answer": data.answer,
                            "status": "awaiting_review",
                            "rubric": task["rubric"],
                        }
                    ),
                    time.time(),
                ),
            )
            return {
                "correct": None,
                "reason": "Saved for review against the rubric. This submission does not yet update proof mastery.",
                "rubric": task["rubric"],
            }
        correct = data.answer == task["answer"]
        saved = con.execute("SELECT value FROM kv WHERE key='profile'").fetchone()
        profile = json.loads(saved[0]) if saved else {"skills": {}}
        estimate = problems.update_skill(profile, row["concept"], row["dimension"], correct, data.assisted)
        profile.setdefault("reviews", {})[row["concept"]] = time.time() + (86400 * 3 if correct else 86400)
        con.execute("INSERT OR REPLACE INTO kv VALUES ('profile',?)", (json.dumps(profile),))
        if profile.get("research_consent"):
            con.execute(
                "INSERT INTO events(kind,payload,created) VALUES (?,?,?)",
                (
                    "learning-observation",
                    json.dumps(
                        {
                            "concept": row["concept"],
                            "dimension": row["dimension"],
                            "correct": correct,
                            "assisted": data.assisted,
                            "release": worker.current()["version"],
                        }
                    ),
                    time.time(),
                ),
            )
    return {"correct": correct, "reason": task["reason"], "answer": task["answer"], "estimate": estimate}


class Chat(BaseModel):
    concept: str = Field(max_length=100)
    message: str = Field(min_length=1, max_length=6000)
    turns: list[dict] = Field(default_factory=list, max_length=8)


@app.post("/api/chat", dependencies=[Depends(auth.require_owner)])
async def chat(data: Chat):
    snapshot, profile = worker.current(), store.get("profile", {})
    if data.concept not in {n["id"] for n in snapshot["concepts"]}:
        raise HTTPException(400, "Unknown concept")
    try:
        text, usage = await provider.complete(
            provider.context(snapshot, profile, data.concept, data.message, data.turns)
        )
        mode = "model"
    except (provider.ProviderUnavailable, httpx.HTTPError, KeyError, ValueError):
        lesson = snapshot.get("lessons", {}).get(data.concept, {})
        text = (
            "Let's take one step. "
            + lesson.get("intuition", "Choose a specific claim or example to explore.")
            + "\n\nWhat part of this matches your current picture, and where does that picture stop being clear?"
        )
        mode, usage = "local-guide", {}
    if profile.get("retain_conversations"):
        store.event(
            "conversation",
            {
                "concept": data.concept,
                "user": data.message,
                "assistant": text,
                "release": snapshot["version"],
            },
        )
    return {"text": text, "mode": mode, "release": snapshot["version"], "usage": usage}


@app.get("/api/library", dependencies=[Depends(auth.require_owner)])
async def library_search(q: str = ""):
    if len(q) > 200:
        raise HTTPException(400, "Search is too long")
    try:
        return await library.pages(q)
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(502, "The private library is unavailable") from exc


@app.post("/api/library/{source_id}", dependencies=[Depends(auth.require_owner)])
async def save_source(source_id: str):
    source = next((s for s in content.read("sources.json") if s["id"] == source_id), None)
    if source is None:
        raise HTTPException(404, "Unknown source")
    try:
        return await library.save_reference(source)
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(502, "Could not save the reference in the private library") from exc


@app.post("/api/jobs/{role}", dependencies=[Depends(auth.require_owner)])
def request_job(role: str):
    if role not in worker.ROLES:
        raise HTTPException(404, "Unknown role")
    with store.db() as con:
        con.execute("UPDATE jobs SET next_run=0 WHERE role=? AND status!='running'", (role,))
    return {"status": "queued", "role": role}


@app.post("/api/proposals/{key}/promote", dependencies=[Depends(auth.require_owner)])
def promote(key: str):
    with store.db() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT * FROM proposals WHERE id=? AND status='pending'", (key,)).fetchone()
        saved = con.execute("SELECT value FROM kv WHERE key='snapshot'").fetchone()
        active = json.loads(saved[0])
        if row is None:
            raise HTTPException(404, "Proposal is unavailable")
        payload = json.loads(row["payload"])
        if payload["base_version"] != active["version"]:
            raise HTTPException(409, "This candidate was based on an older release; create a new candidate")
        proposed = copy.deepcopy(payload["snapshot"])
        content.validate_snapshot(proposed)
        proposed["version"] = content.snapshot_id(proposed)
        con.execute(
            "INSERT OR REPLACE INTO kv VALUES (?,?)", ("release:" + proposed["version"], json.dumps(proposed))
        )
        con.execute("INSERT OR REPLACE INTO kv VALUES ('snapshot',?)", (json.dumps(proposed),))
        con.execute("UPDATE proposals SET status='promoted' WHERE id=?", (key,))
    return {"version": proposed["version"]}


@app.get("/api/export", dependencies=[Depends(auth.require_owner)])
def export():
    with store.db() as con:
        events = [dict(r) for r in con.execute("SELECT * FROM events")]
    return JSONResponse(
        {"profile": store.get("profile", {}), "events": events},
        headers={"Content-Disposition": 'attachment; filename="pathweave-data.json"'},
    )


@app.delete("/api/profile", dependencies=[Depends(auth.require_owner)])
def delete_profile():
    with store.db() as con:
        con.execute("DELETE FROM kv WHERE key IN ('profile','analysis')")
        con.execute("DELETE FROM events")
        con.execute("DELETE FROM attempts")
        con.execute("UPDATE jobs SET result=NULL WHERE role='analysis'")
    return {"ok": True}


app.mount("/assets", StaticFiles(directory=STATIC), name="assets")


@app.get("/")
@app.get("/login")
def index():
    return FileResponse(STATIC / "index.html")
