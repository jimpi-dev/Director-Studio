import json

import httpx
import pytest

from app.core.comfy import catalog as catalog_module
from app.core.comfy.catalog import fetch_userdata_json, list_userdata_workflows
from app.core.comfy.client import ComfyClient


@pytest.mark.asyncio
async def test_list_userdata_workflows_filters_json(monkeypatch):
    monkeypatch.setattr(
        catalog_module,
        "workflow_userdata_dirs",
        lambda: ("workflows",),
    )
    client = ComfyClient("http://127.0.0.1:8188")

    async def fake_get(self, url, *args, **kwargs):
        request = httpx.Request("GET", url)
        return httpx.Response(
            200,
            json=[
                {"path": "workflows/h3_custom.api.json", "size": 10, "modified": 1},
                {"path": "workflows/readme.txt", "size": 2, "modified": 1},
            ],
            request=request,
        )

    monkeypatch.setattr(catalog_module.httpx.AsyncClient, "get", fake_get)
    rows = await list_userdata_workflows(client)
    assert len(rows) == 1
    assert rows[0]["path"] == "workflows/h3_custom.api.json"


@pytest.mark.asyncio
async def test_fetch_userdata_json_rejects_ui_format(monkeypatch):
    async def fake_get(self, url, *args, **kwargs):
        request = httpx.Request("GET", url)
        return httpx.Response(
            200,
            content=json.dumps({"nodes": [], "links": []}).encode(),
            request=request,
        )

    monkeypatch.setattr(catalog_module.httpx.AsyncClient, "get", fake_get)
    with pytest.raises(ValueError, match="API format"):
        await fetch_userdata_json(ComfyClient("http://127.0.0.1:8188"), "workflows/ui.json")
