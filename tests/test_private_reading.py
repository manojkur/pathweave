import asyncio
import json

import httpx

from learninglab import content, library, provider


def test_passage_selection_and_model_context_are_bounded():
    text = "Unrelated front matter. " * 200 + "Exponential growth solves a differential equation. " * 50
    excerpt = library.select_passage(text, "exponential differential growth")
    assert "Exponential growth" in excerpt
    assert len(excerpt) <= 1200
    assert library.select_passage(text, "nonexistentkeyword") == ""
    passages = [{"source_id": "book", "title": "Source", "text": "x" * 5000}] * 8
    messages = provider.context(content.initial_snapshot(), {}, "ode-growth", "question", [], passages)
    payload = json.loads(messages[0]["content"].split("\n", 1)[1])
    assert len(payload["private_reading"]) == 2
    assert sum(len(p["text"]) for p in payload["private_reading"]) == 2400


def test_reading_fetch_is_authenticated_bounded_and_does_not_follow_source_links(monkeypatch):
    monkeypatch.setenv("LIBRARY_API_URL", "https://library.example")
    monkeypatch.setenv("LIBRARY_API_TOKEN", "owner-token")
    monkeypatch.delenv("LIBRARY_SECONDARY_API_URL", raising=False)

    async def pages(_query):
        return {"items": [{"id": "page-1", "title": "Source", "url": "https://library.example/kb/page-1"}]}

    monkeypatch.setattr(library, "pages", pages)
    seen = []

    def transport(request):
        seen.append(request)
        assert str(request.url) == "https://library.example/api/v1/pages/page-1"
        assert request.headers["Authorization"] == "Bearer owner-token"
        return httpx.Response(200, json={"extracted_text": "Exponential growth and differential equations. " * 200})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(library.httpx, "AsyncClient", lambda **kwargs: real_client(
        **kwargs, transport=httpx.MockTransport(transport),
    ))
    result = asyncio.run(library.passages([{"id": "book", "title": "Source"}], "exponential growth"))
    assert len(result) == 1 and len(result[0]["text"]) <= 1200
    assert result[0]["source_id"] == "book"
    assert len(seen) == 1

    def oversized(_request):
        return httpx.Response(200, content=b"x" * (4 * 1024 * 1024 + 1))

    monkeypatch.setattr(library.httpx, "AsyncClient", lambda **kwargs: real_client(
        **kwargs, transport=httpx.MockTransport(oversized),
    ))
    assert asyncio.run(library.passages([{"id": "book", "title": "Source"}], "growth")) == []
