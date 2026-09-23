"""Read-only discovery of ComfyUI model folders and saved user workflows."""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

import httpx

from ...config import settings
from .client import ComfyClient, ComfyError


def workflow_userdata_dirs() -> tuple[str, ...]:
    raw = (getattr(settings, "comfy_workflow_userdata_dirs", None) or "workflows").strip()
    parts = [item.strip() for item in raw.split(",") if item.strip()]
    return tuple(parts or ("workflows",))


async def list_model_files(client: ComfyClient, folder: str) -> list[str]:
    async with httpx.AsyncClient(timeout=30.0) as http:
        response = await http.get(f"{client.base_url}/models/{quote(folder, safe='')}")
        if response.status_code == 404:
            return []
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, list):
        raise ComfyError(f"ComfyUI /models/{folder} returned a non-list response")
    return sorted(str(item) for item in payload if isinstance(item, str))


async def list_userdata_workflows(client: ComfyClient) -> list[dict[str, Any]]:
    """List JSON workflows under configured ComfyUI userdata directories."""
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    async with httpx.AsyncClient(timeout=30.0) as http:
        for directory in workflow_userdata_dirs():
            response = await http.get(
                f"{client.base_url}/userdata",
                params={
                    "dir": directory,
                    "recurse": "true",
                    "full_info": "true",
                },
            )
            if response.status_code in {403, 404}:
                continue
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                continue
            for item in payload:
                if isinstance(item, dict):
                    rel = str(item.get("path") or "").replace("\\", "/")
                    size = item.get("size")
                    modified = item.get("modified")
                elif isinstance(item, str):
                    rel = item.replace("\\", "/")
                    size = None
                    modified = None
                else:
                    continue
                if not rel.lower().endswith(".json"):
                    continue
                if rel in seen:
                    continue
                seen.add(rel)
                entries.append(
                    {
                        "path": rel,
                        "directory": directory,
                        "size": size,
                        "modified": modified,
                    }
                )
    entries.sort(key=lambda row: row["path"].lower())
    return entries


async def fetch_userdata_json(client: ComfyClient, userdata_path: str) -> dict[str, Any]:
    normalized = userdata_path.replace("\\", "/").lstrip("/")
    if not normalized or ".." in normalized.split("/"):
        raise ValueError("Invalid ComfyUI workflow path")
    encoded = quote(normalized, safe="/")
    async with httpx.AsyncClient(timeout=60.0) as http:
        response = await http.get(f"{client.base_url}/userdata/{encoded}")
        if response.status_code == 404:
            raise ComfyError(f"ComfyUI workflow not found: {normalized}")
        response.raise_for_status()
        raw = response.content
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError("Workflow exceeds the 8 MiB limit")
    try:
        graph = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Workflow must contain valid UTF-8 JSON") from exc
    if not isinstance(graph, dict):
        raise ValueError("Workflow JSON must be an object")
    if "nodes" in graph and not any(
        isinstance(value, dict) and "class_type" in value for value in graph.values()
    ):
        raise ValueError(
            "This is a ComfyUI UI workflow. Re-save or export it in API format "
            "(top-level node IDs with class_type inputs) before importing."
        )
    return graph


async def browse_comfy_library() -> dict[str, Any]:
    client = ComfyClient()
    reachable = False
    loras: list[str] = []
    workflows: list[dict[str, Any]] = []
    errors: list[str] = []
    try:
        await client.health()
        reachable = True
    except Exception as exc:  # noqa: BLE001
        errors.append(f"ComfyUI unreachable: {exc}")
        return {
            "reachable": False,
            "base_url": client.base_url,
            "loras": [],
            "workflows": [],
            "workflow_dirs": list(workflow_userdata_dirs()),
            "errors": errors,
        }
    try:
        loras = await list_model_files(client, "loras")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Could not list LoRAs: {exc}")
    try:
        workflows = await list_userdata_workflows(client)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Could not list userdata workflows: {exc}")
    return {
        "reachable": reachable,
        "base_url": client.base_url,
        "loras": loras,
        "workflows": workflows,
        "workflow_dirs": list(workflow_userdata_dirs()),
        "errors": errors,
    }
