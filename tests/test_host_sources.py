import asyncio
import json

import httpx
import pytest

from learninglab import library


def test_host_owns_destination_and_reading_budget(monkeypatch):
    monkeypatch.setenv("HOST_SOURCE_URL", "http://source-broker:8000/sources")
    monkeypatch.setenv("HOST_SOURCE_TOKEN", "test-host-token-" * 4)
    monkeypatch.setenv("LIBRARY_API_URL", "https://unused-library.example")
    monkeypatch.setenv("LIBRARY_API_TOKEN", "must-not-be-forwarded")
    seen = []

    def transport(request):
        seen.append(request)
        assert str(request.url) == "http://source-broker:8000/sources"
        assert request.headers["Authorization"] == "Bearer " + "test-host-token-" * 4
        payload = json.loads(request.content)
        assert payload["operation"] == "read" and len(payload["query"]) <= 600
        return httpx.Response(200, json={"items": [{"source_id": "book", "title": "Reading", "text": "x" * 5000}] * 4})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(library.httpx, "AsyncClient", lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(transport)))
    result = asyncio.run(library.passages([], "q" * 1000))
    assert len(seen) == 1 and len(result) == 2
    assert sum(len(item["text"]) for item in result) == 2400

    def redirect(_request):
        return httpx.Response(307, headers={"Location": "https://another.example/"})

    monkeypatch.setattr(library.httpx, "AsyncClient", lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(redirect)))
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(library.passages([], "question"))

    def oversized(_request):
        return httpx.Response(200, content=b"x" * (512 * 1024 + 1))

    monkeypatch.setattr(library.httpx, "AsyncClient", lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(oversized)))
    with pytest.raises(ValueError):
        asyncio.run(library.passages([], "question"))


def test_host_endpoint_rejects_untrusted_cleartext_and_missing_credential(monkeypatch):
    monkeypatch.setenv("HOST_SOURCE_URL", "http://external.example/sources")
    monkeypatch.setenv("HOST_SOURCE_TOKEN", "test-token-" * 4)
    with pytest.raises(ValueError):
        library.host_config()
    monkeypatch.setenv("HOST_SOURCE_URL", "https://sources.example/endpoint")
    monkeypatch.setenv("HOST_SOURCE_TOKEN", "")
    with pytest.raises(ValueError):
        library.host_config()
