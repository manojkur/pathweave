"""Optional private library adapter. Git carries references, never source files."""

import os
from urllib.parse import urlparse

import httpx


def config():
    base, token = os.environ.get("LIBRARY_API_URL", "").rstrip("/"), os.environ.get("LIBRARY_API_TOKEN", "")
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
    base, token = cfg
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        response = await client.get(
            base + "/api/v1/pages",
            params={"q": query, "limit": 30},
            headers={"Authorization": "Bearer " + token},
        )
        response.raise_for_status()
        data = response.json()
    # Only metadata crosses into the browser; no signed file URLs are exposed here.
    return {
        "connected": True,
        "items": [
            {"id": p["id"], "title": p["title"], "type": p.get("type"), "url": base + "/kb/" + p["id"]}
            for p in data.get("items", [])
        ],
    }


async def save_reference(source):
    cfg = config()
    if cfg is None:
        raise ValueError("Connect a private library before saving references")
    base, token = cfg
    # Check by stable public source id so retries do not duplicate existing references.
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
