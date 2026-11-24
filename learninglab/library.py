"""Optional private library adapter. Git carries references, never source files."""

import os
import re
from urllib.parse import urlparse

import httpx


def host_config():
    url = os.environ.get("HOST_SOURCE_URL", "")
    token = os.environ.get("HOST_SOURCE_TOKEN", "")
    if not url:
        return None
    parsed = urlparse(url)
    private_http = parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost", "source-broker"}
    if (not private_http and parsed.scheme != "https") or not parsed.hostname or parsed.username or parsed.query or parsed.fragment or len(token) < 32:
        raise ValueError("The host source service needs a trusted endpoint and credential")
    return url, token


def connected():
    return bool(host_config() or config())


async def host_request(operation, **payload):
    url, token = host_config()
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        async with client.stream("POST", url, json={"operation": operation, **payload},
                                 headers={"Authorization": "Bearer " + token}) as response:
            response.raise_for_status()
            raw = bytearray()
            async for chunk in response.aiter_bytes():
                if len(raw) + len(chunk) > 512 * 1024:
                    raise ValueError("Source service response exceeds the retrieval limit")
                raw.extend(chunk)
    import json
    return json.loads(raw)


async def relevant(query, sources=()):
    if host_config():
        return await host_request("search", query=query[:600], sources=list(sources)[:10])
    return await pages(query[:200])


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
    if host_config():
        return await host_request("search", query=query[:600])
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
    if host_config():
        return await host_request("save", source=source)
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

    if host_config():
        return await host_request("notebook", snapshot=snapshot, report=report)
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
    if host_config():
        return await host_request("provider", key=key, model=model)
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


def select_passage(text, query, limit=1200):
    """Select bounded explanatory text, excluding index and contents fragments."""
    stop = {"what", "when", "where", "which", "that", "this", "with", "from", "have", "explain", "please", "about", "before", "there", "every", "entire", "introduction", "would", "could", "their", "these", "those", "then"}
    terms = list(dict.fromkeys(
        word.casefold().rstrip("s") for word in re.findall(r"\w{4,}", query)
        if word.casefold() not in stop
    ))[:20]
    best, best_score = "", 0
    for start in range(0, len(text), 700):
        window = text[start:start + limit]
        if start and text[start - 1].isalnum():
            window = window.partition(" ")[2]
        lines = [line.strip() for line in window.splitlines() if line.strip()]
        index_rows = sum(bool(re.search(r"[,\u2026.]\s*\d+(?:\s*[,–-]\s*\d+)*\s*$", line)) for line in lines)
        if len(lines) >= 6 and index_rows / len(lines) > .35:
            continue
        if window.count("...") >= 5:
            continue
        folded = window.casefold()
        score = sum(min(folded.count(term), 3) for term in terms)
        # Dense prose is more useful than a list of page references or isolated labels.
        if len(re.findall(r"[.!?]\s", window)) < 2:
            score *= .5
        if score > best_score:
            best, best_score = window, score
    return best.rsplit(" ", 1)[0].strip() if best else ""

async def passages(sources, query):
    """Read at most two bounded private excerpts; never persist the corpus here."""
    if host_config():
        data = await host_request("read", sources=sources[:10], query=query[:600])
        # Treat the host response as data. Preserve the same reading budget as standalone retrieval.
        return [{"source_id": str(item["source_id"])[:100], "title": str(item["title"])[:300],
                 "url": str(item.get("url", ""))[:2000], "text": str(item["text"])[:1200],
                 "review_status": "Unreviewed automatic extraction"}
                for item in data.get("items", [])[:2] if item.get("text")]
    primary = config()
    if primary is None:
        return []
    connections = [item for item in [primary, config("LIBRARY_SECONDARY")] if item]
    results = []
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for source in sources[:2]:
            try:
                matches = await pages(source["title"])
            except (httpx.HTTPError, ValueError):
                continue
            for item in matches["items"]:
                if item["title"].casefold() != source["title"].casefold():
                    continue
                if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", item["id"]):
                    continue
                cfg = next((cfg for cfg in connections if item["url"] == cfg[0] + "/kb/" + item["id"]), None)
                if cfg is None:
                    continue
                base, token = cfg
                try:
                    async with client.stream(
                        "GET", base + "/api/v1/pages/" + item["id"],
                        headers={"Authorization": "Bearer " + token},
                    ) as response:
                        response.raise_for_status()
                        raw = bytearray()
                        async for chunk in response.aiter_bytes():
                            if len(raw) + len(chunk) > 4 * 1024 * 1024:
                                raise ValueError("Source response exceeds the retrieval limit")
                            raw.extend(chunk)
                    import json

                    page = json.loads(raw)
                    # Cite actual source text only, not a catalog card mistaken for a book.
                    excerpt = select_passage(page.get("extracted_text") or "", query)
                    if excerpt:
                        results.append({
                            "source_id": source["id"], "title": item["title"], "url": item["url"],
                            "text": excerpt, "review_status": "Unreviewed automatic PDF extraction",
                        })
                        break
                except (httpx.HTTPError, ValueError, KeyError):
                    continue
    return results
