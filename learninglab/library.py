"""Optional private library adapter. Git carries references, never source files."""

import os
from urllib.parse import urlparse

import httpx


def config(prefix="LIBRARY"):
    base, token = (
        os.environ.get(prefix + "_API_URL", "").rstrip("/"),
        os.environ.get(prefix + "_API_TOKEN", ""),
    )
    if not base or not token:
        return None
    parsed = urlparse(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username:
        raise ValueError("Library connector requires an HTTPS endpoint")
    return base, token


async def pages(query):
    cfg = config()
    if cfg is None:
        return {"connected": False, "items": []}
    all_items, warnings = [], []
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for connection in [cfg, config("LIBRARY_SECONDARY")]:
            if connection is None:
                continue
            base, token = connection
            try:
                response = await client.get(
                    base + "/api/v1/pages",
                    params={"q": query, "limit": 30},
                    headers={"Authorization": "Bearer " + token},
                )
                response.raise_for_status()
                data = response.json()
                all_items.extend(
                    {
                        "id": p["id"],
                        "title": p["title"],
                        "type": p.get("page_type"),
                        "url": base + "/kb/" + p["id"],
                    }
                    for p in data.get("items", [])
                )
            except httpx.HTTPError:
                warnings.append("A configured library connection is temporarily unavailable")
    # Only metadata crosses into the browser; no signed file URLs are exposed here.
    return {
        "connected": True,
        "items": all_items,
        "warnings": warnings,
    }


async def save_reference(source):
    cfg = config()
    if cfg is None:
        raise ValueError("Connect a private library before saving references")
    base, token = cfg
    # Exact title check makes normal retries idempotent across the configured libraries.
    existing = await pages(source["title"])
    for item in existing["items"]:
        if item["title"] == source["title"]:
            return item
    payload = {
        "title": source["title"],
        "page_type": "document",
        "content_text": "Reference: " + source["url"] + "\n\n" + source.get("summary", ""),
        "metadata": {
            "external_source_id": source["id"],
            "source_url": source["url"],
            "review_status": source.get("review_status", "unreviewed"),
            "rights": "Reference metadata only; obtain source files through authorized access.",
        },
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            base + "/api/v1/pages", json=payload, headers={"Authorization": "Bearer " + token}
        )
        response.raise_for_status()
        page = response.json()
    return {"id": page["id"], "title": page["title"], "url": base + "/kb/" + page["id"]}


async def sync_notebook(snapshot, report):
    """Publish current project state into the private library, without learner records."""
    import json

    cfg = config()
    if cfg is None:
        return {"connected": False}
    base, token = cfg
    title = "Pathweave research notebook"
    payload = {
        "title": title,
        "page_type": "note",
        "content_text": json.dumps(
            {
                "project": "Pathweave",
                "current_release": snapshot["version"],
                "workspace": os.environ.get("WORKSPACE_URL", ""),
                "repository": "https://github.com/manojkur/pathweave",
                "concepts": len(snapshot["concepts"]),
                "pilot_lessons": len(snapshot["lessons"]),
                "report": report,
                "evidence_boundary": "Synthetic experiments and scoping reviews; no human efficacy established",
            },
            indent=2,
        ),
        "metadata": {"external_source_id": "pathweave:current-state", "integration": "pathweave"},
    }
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        headers = {"Authorization": "Bearer " + token}
        response = await client.get(base + "/api/v1/pages", params={"q": title, "limit": 30}, headers=headers)
        response.raise_for_status()
        existing = next((p for p in response.json().get("items", []) if p["title"] == title), None)
        if existing:
            response = await client.patch(
                base + "/api/v1/pages/" + existing["id"], json=payload, headers=headers
            )
        else:
            response = await client.post(base + "/api/v1/pages", json=payload, headers=headers)
        response.raise_for_status()
    return {"connected": True, "page_id": response.json()["id"]}


async def configure_provider(key, model):
    """Explicit owner-requested credential sharing with configured private workspaces."""
    updated, failed = 0, 0
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for cfg in [config(), config("LIBRARY_SECONDARY")]:
            if cfg is None:
                continue
            base, token = cfg
            headers = {"Authorization": "Bearer " + token}
            try:
                response = await client.get(base + "/api/v1/api-keys", headers=headers)
                response.raise_for_status()
                previous = [
                    r["id"]
                    for r in response.json()
                    if r["provider"] == "openrouter" and r["label"] == "Pathweave connection"
                ]
                response = await client.post(
                    base + "/api/v1/api-keys",
                    headers=headers,
                    json={"provider": "openrouter", "api_key": key, "label": "Pathweave connection"},
                )
                response.raise_for_status()
                for tier in ["light", "medium", "heavy"]:
                    response = await client.put(
                        base + "/api/v1/model-tiers/" + tier,
                        headers=headers,
                        json={"provider": "openrouter", "model": model},
                    )
                    response.raise_for_status()
                for old in previous:
                    response = await client.delete(base + "/api/v1/api-keys/" + old, headers=headers)
                    response.raise_for_status()
                updated += 1
            except httpx.HTTPError:
                failed += 1
    return {"updated": updated, "failed": failed}
