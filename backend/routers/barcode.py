"""Barcode lookup router — Open Food Facts proxy (ITEM-02, ITEM-08).

Threat mitigations (STRIDE):
  - T-03-01 (Tampering via path injection): path param validated as 8-20 digits
    via FastAPI Path regex. Non-digit values rejected with 422 before the
    handler runs, preventing SSRF/path-traversal into the OFF URL.
  - T-03-03 (Information Disclosure via OFF response forwarding): response is
    serialized through a Pydantic model with `extra='forbid'`, whitelisting
    exactly the 7 fields the frontend needs. Raw OFF fields (brands,
    ingredients_text, etc.) are dropped.

Timeout (Pitfall 8): httpx.AsyncClient(timeout=5.0) ensures mobile clients
never hang behind the HA ingress proxy.
"""
from __future__ import annotations

from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/api/barcode", tags=["barcode"])

OFF_URL = "https://world.openfoodfacts.net/api/v2/product/{code}"
OFF_FIELDS = "product_name,image_url,nutriments"
OFF_USER_AGENT = "Inventar/0.1 (home-assistant-addon)"
OFF_TIMEOUT_SECONDS = 5.0


class BarcodeProduct(BaseModel):
    """Normalized, whitelisted product data returned to the SPA.

    extra='forbid' (ASVS V5): no raw OFF field can leak through this envelope.
    All fields nullable so the frontend can open ItemDrawer with partial data
    (e.g. name known, nutrition unknown).
    """

    model_config = ConfigDict(extra="forbid")

    barcode: str
    name: Optional[str] = None
    image_url: Optional[str] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None


@router.get("/{code}", response_model=BarcodeProduct)
async def lookup_barcode(
    code: str = Path(..., pattern=r"^[0-9]{8,20}$"),
) -> BarcodeProduct:
    url = OFF_URL.format(code=code)
    try:
        async with httpx.AsyncClient(timeout=OFF_TIMEOUT_SECONDS) as http:
            resp = await http.get(
                url,
                params={"fields": OFF_FIELDS},
                headers={"User-Agent": OFF_USER_AGENT},
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Barcode lookup timed out")

    if resp.status_code != 200:
        # Treat upstream 4xx/5xx as "not found" so the frontend falls back to
        # manual entry with the barcode pre-filled (D-08 — no error state).
        raise HTTPException(status_code=404, detail="Product not found")

    data = resp.json()
    if data.get("status") != 1:
        raise HTTPException(status_code=404, detail="Product not found")

    product = data.get("product", {}) or {}
    nutriments = product.get("nutriments", {}) or {}

    return BarcodeProduct(
        barcode=code,
        # Pitfall 6: OFF stores some products with empty product_name — coerce
        # to None so the SPA treats it as "missing" and leaves the field blank.
        name=(product.get("product_name") or None),
        image_url=(product.get("image_url") or None),
        calories=nutriments.get("energy-kcal_100g"),
        protein=nutriments.get("proteins_100g"),
        carbs=nutriments.get("carbohydrates_100g"),
        fat=nutriments.get("fat_100g"),
    )
