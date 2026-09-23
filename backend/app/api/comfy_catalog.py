"""ComfyUI-side discovery (LoRAs, saved workflows) for Settings UI."""

from __future__ import annotations

from fastapi import APIRouter

from ..core.comfy.catalog import browse_comfy_library

router = APIRouter(prefix="/comfy", tags=["comfy"])


@router.get("/catalog")
async def comfy_catalog() -> dict:
    """List LoRA files and saved userdata workflows from the configured ComfyUI server."""
    return await browse_comfy_library()
