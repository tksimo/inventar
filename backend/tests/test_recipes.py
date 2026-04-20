"""Wave 0 RED tests for Phase 5 recipes. All tests fail until Plans 02-03 implement the router.

Requirement coverage (05-VALIDATION.md):
  RECP-01: create/list/get/update/delete (11 tests)
  RECP-02: import-url (6 tests)
  RECP-03: check-ingredients (5 tests)
  RECP-04: add-missing (4 tests)
  RECP-05: cook (7 tests)

Helpers mirror tests/test_shopping_list.py _make_item pattern for consistency.
"""
from __future__ import annotations

import pytest
from sqlalchemy import inspect

from db.database import engine, SessionLocal
from models import (
    Item,
    Recipe,
    RecipeIngredient,
    ShoppingListEntry,
    Transaction,
    QuantityMode,
    StockStatus,
)


@pytest.fixture()
def db_session():
    """Per-test DB session with isolation: wipe recipe + shopping_list + item tables first."""
    session = SessionLocal()
    try:
        session.query(RecipeIngredient).delete()
        session.query(Recipe).delete()
        session.query(ShoppingListEntry).delete()
        session.query(Transaction).delete()
        session.query(Item).delete()
        session.commit()
        yield session
    finally:
        session.close()


def _make_item(
    session,
    *,
    name="Item",
    threshold=None,
    quantity=None,
    quantity_mode=QuantityMode.EXACT,
    status=None,
    archived=False,
):
    item = Item(
        name=name,
        quantity_mode=quantity_mode,
        quantity=quantity,
        status=status,
        reorder_threshold=threshold,
        archived=archived,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def _make_recipe(session, *, name="Recipe", ingredients=None):
    recipe = Recipe(name=name)
    session.add(recipe)
    session.flush()
    for idx, ing in enumerate(ingredients or []):
        session.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                name=ing["name"],
                quantity=ing.get("quantity"),
                unit=ing.get("unit"),
                item_id=ing.get("item_id"),
                sort_order=idx,
            )
        )
    session.commit()
    session.refresh(recipe)
    return recipe


# ---------------------------------------------------------------------------
# Schema check -- Task 1 migration / ORM sanity
# ---------------------------------------------------------------------------


def test_recipes_tables_exist():
    """Migration 0005 / ORM created recipes + recipe_ingredients + free_text column."""
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    assert "recipes" in tables
    assert "recipe_ingredients" in tables

    ri_cols = {c["name"] for c in insp.get_columns("recipe_ingredients")}
    assert {"recipe_id", "name", "quantity", "unit", "item_id", "sort_order"}.issubset(ri_cols)

    sl_cols = {c["name"]: c for c in insp.get_columns("shopping_list")}
    assert "free_text" in sl_cols
    assert sl_cols["item_id"]["nullable"] is True


# ---------------------------------------------------------------------------
# RECP-01 CRUD
# ---------------------------------------------------------------------------


def test_create_recipe_minimal(client, db_session):
    r = client.post("/api/recipes/", json={"name": "Bread"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Bread"
    assert body["ingredients"] == []
    assert "id" in body and body["id"] > 0


def test_create_recipe_with_ingredients(client, db_session):
    r = client.post(
        "/api/recipes/",
        json={
            "name": "Pasta",
            "ingredients": [
                {"name": "Pasta", "quantity": 500, "unit": "g"},
                {"name": "Salt", "quantity": 1, "unit": "tsp"},
            ],
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert len(body["ingredients"]) == 2
    assert body["ingredients"][0]["name"] == "Pasta"
    assert body["ingredients"][0]["quantity"] == 500
    assert body["ingredients"][0]["unit"] == "g"


def test_create_recipe_rejects_empty_name(client, db_session):
    r = client.post("/api/recipes/", json={"name": ""})
    assert r.status_code == 422


def test_create_recipe_rejects_unknown_field(client, db_session):
    r = client.post("/api/recipes/", json={"name": "X", "invented_field": "nope"})
    assert r.status_code == 422


def test_list_recipes_empty(client, db_session):
    r = client.get("/api/recipes/")
    assert r.status_code == 200
    assert r.json() == []


def test_list_recipes_returns_items(client, db_session):
    _make_recipe(db_session, name="A", ingredients=[{"name": "X"}])
    _make_recipe(db_session, name="B", ingredients=[{"name": "Y"}, {"name": "Z"}])
    r = client.get("/api/recipes/")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    names = {row["name"] for row in body}
    assert names == {"A", "B"}
    # Each row has ingredient_count
    for row in body:
        assert "ingredient_count" in row


def test_get_recipe_detail(client, db_session):
    recipe = _make_recipe(
        db_session, name="Soup",
        ingredients=[{"name": "Water", "quantity": 1, "unit": "L"}],
    )
    r = client.get(f"/api/recipes/{recipe.id}")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Soup"
    assert len(body["ingredients"]) == 1
    assert body["ingredients"][0]["name"] == "Water"


def test_get_recipe_404(client, db_session):
    r = client.get("/api/recipes/99999")
    assert r.status_code == 404


def test_update_recipe_name(client, db_session):
    recipe = _make_recipe(db_session, name="Old")
    r = client.patch(f"/api/recipes/{recipe.id}", json={"name": "New"})
    assert r.status_code == 200
    assert r.json()["name"] == "New"


def test_update_recipe_replaces_ingredients(client, db_session):
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Old1"}, {"name": "Old2"}],
    )
    r = client.patch(
        f"/api/recipes/{recipe.id}",
        json={"ingredients": [{"name": "New1"}]},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["ingredients"]) == 1
    assert body["ingredients"][0]["name"] == "New1"


def test_delete_recipe_cascades(client, db_session):
    recipe = _make_recipe(
        db_session, name="ToDelete",
        ingredients=[{"name": "A"}, {"name": "B"}],
    )
    rid = recipe.id
    r = client.delete(f"/api/recipes/{rid}")
    assert r.status_code in (200, 204)
    # Recipe gone
    assert client.get(f"/api/recipes/{rid}").status_code == 404
    # Ingredients cascade-deleted
    remaining = db_session.query(RecipeIngredient).filter_by(recipe_id=rid).count()
    assert remaining == 0


# ---------------------------------------------------------------------------
# RECP-02 URL import
# ---------------------------------------------------------------------------


_JSON_LD_HTML = """<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Recipe",
  "name": "Test Recipe",
  "recipeIngredient": ["250g Mehl", "2 Eier"],
  "recipeInstructions": "Mix and bake."
}
</script>
</head><body></body></html>"""


_GRAPH_WRAPPED_HTML = """<html><head>
<script type="application/ld+json">
{"@context": "https://schema.org/", "@graph": [
  {"@type": "WebPage", "name": "Page"},
  {"@type": "Recipe", "name": "Graph Recipe", "recipeIngredient": ["100g Sugar"]}
]}
</script></head><body></body></html>"""


_TITLE_ONLY_HTML = "<html><head><title>Bare Title Recipe</title></head><body>no json-ld</body></html>"


@pytest.fixture()
def mock_httpx_response(monkeypatch):
    """Factory that patches httpx.AsyncClient to return a given HTML body / status."""

    def _apply(html: str, status: int = 200):
        class _Resp:
            def __init__(self):
                self.status_code = status
                self.text = html
                self.content = html.encode("utf-8")

            def raise_for_status(self):
                if status >= 400:
                    raise Exception("HTTP " + str(status))

        class _FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return None

            async def get(self, *args, **kwargs):
                return _Resp()

        import httpx
        monkeypatch.setattr(httpx, "AsyncClient", _FakeClient)

    return _apply


def test_import_url_json_ld(client, db_session, mock_httpx_response):
    mock_httpx_response(_JSON_LD_HTML)
    r = client.post("/api/recipes/import-url", json={"url": "https://example.com/r"})
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Test Recipe"
    # Ingredients parsed from recipeIngredient[] strings
    assert len(body["ingredients"]) == 2
    names = [i["name"] for i in body["ingredients"]]
    assert "Mehl" in names[0] or "Mehl" in " ".join(names)


def test_import_url_graph_wrapped(client, db_session, mock_httpx_response):
    mock_httpx_response(_GRAPH_WRAPPED_HTML)
    r = client.post("/api/recipes/import-url", json={"url": "https://example.com/chefkoch"})
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Graph Recipe"
    assert len(body["ingredients"]) == 1


def test_import_url_no_json_ld_fallback(client, db_session, mock_httpx_response):
    mock_httpx_response(_TITLE_ONLY_HTML)
    r = client.post("/api/recipes/import-url", json={"url": "https://example.com/x"})
    # D-06: fallback pre-fills recipe name from <title> if extractable
    assert r.status_code == 200
    body = r.json()
    assert "Bare Title Recipe" in body["name"]
    assert body["ingredients"] == []


def test_import_url_network_error(client, db_session, monkeypatch):
    # httpx raises -- backend must fall back to empty manual entry with no name
    import httpx

    class _FailingClient:
        def __init__(self, *a, **k):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return None
        async def get(self, *a, **k):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(httpx, "AsyncClient", _FailingClient)
    r = client.post("/api/recipes/import-url", json={"url": "https://example.com/z"})
    # Either fallback 200 with empty name or explicit error 502 -- both acceptable per D-06
    assert r.status_code in (200, 502)


def test_import_url_rejects_file_scheme(client, db_session):
    r = client.post("/api/recipes/import-url", json={"url": "file:///etc/passwd"})
    assert r.status_code == 422


def test_import_url_rejects_invalid_url(client, db_session):
    r = client.post("/api/recipes/import-url", json={"url": ""})
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# RECP-03 check
# ---------------------------------------------------------------------------


def test_check_ingredients_linked_have_enough(client, db_session):
    item = _make_item(db_session, name="Milk", quantity=10)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Milk", "quantity": 2, "unit": None, "item_id": item.id}],
    )
    r = client.get(f"/api/recipes/{recipe.id}/check")
    assert r.status_code == 200
    body = r.json()
    assert body["recipe_id"] == recipe.id
    assert len(body["ingredients"]) == 1
    assert body["ingredients"][0]["status"] == "have"
    assert body["ingredients"][0]["unit_mismatch"] is False
    assert body["missing_count"] == 0


def test_check_ingredients_linked_low(client, db_session):
    item = _make_item(db_session, name="Flour", quantity=2)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Flour", "quantity": 5, "unit": None, "item_id": item.id}],
    )
    r = client.get(f"/api/recipes/{recipe.id}/check")
    body = r.json()
    assert body["ingredients"][0]["status"] == "low"


def test_check_ingredients_unlinked_name_match(client, db_session):
    _make_item(db_session, name="Fresh Eggs", quantity=6)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "eggs", "quantity": 3, "unit": None, "item_id": None}],
    )
    r = client.get(f"/api/recipes/{recipe.id}/check")
    body = r.json()
    # substring, case-insensitive -> matches "Fresh Eggs"
    assert body["ingredients"][0]["status"] in ("have", "low")
    assert body["ingredients"][0]["matched_item_name"] == "Fresh Eggs"


def test_check_ingredients_missing(client, db_session):
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Saffron", "quantity": 1, "unit": "pinch"}],
    )
    r = client.get(f"/api/recipes/{recipe.id}/check")
    body = r.json()
    assert body["ingredients"][0]["status"] == "missing"
    assert body["missing_count"] == 1


def test_check_ingredients_unit_mismatch(client, db_session):
    # Recipe "250g" vs inventory count-only -> unit_mismatch=True
    item = _make_item(db_session, name="Sugar", quantity=5)  # count, no unit
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Sugar", "quantity": 250, "unit": "g", "item_id": item.id}],
    )
    r = client.get(f"/api/recipes/{recipe.id}/check")
    body = r.json()
    assert body["ingredients"][0]["unit_mismatch"] is True


# ---------------------------------------------------------------------------
# RECP-04 add-missing
# ---------------------------------------------------------------------------


def test_add_missing_adds_linked_as_item_id(client, db_session):
    item = _make_item(db_session, name="Butter", quantity=0, threshold=2)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Butter", "quantity": 3, "item_id": item.id}],
    )
    r = client.post(f"/api/recipes/{recipe.id}/add-missing")
    assert r.status_code in (200, 201)
    # shopping_list should now contain a row with item_id=item.id
    row = db_session.query(ShoppingListEntry).filter_by(item_id=item.id).first()
    assert row is not None
    assert row.free_text is None


def test_add_missing_adds_unlinked_as_free_text(client, db_session):
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Truffle oil", "quantity": 1, "unit": "tbsp"}],
    )
    r = client.post(f"/api/recipes/{recipe.id}/add-missing")
    assert r.status_code in (200, 201)
    # shopping_list should contain a free_text row (no item_id)
    text_rows = db_session.query(ShoppingListEntry).filter(
        ShoppingListEntry.free_text.isnot(None)
    ).all()
    assert len(text_rows) >= 1
    assert any("Truffle oil" in (row.free_text or "") for row in text_rows)


def test_add_missing_skips_have_ingredients(client, db_session):
    item = _make_item(db_session, name="Water", quantity=100)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Water", "quantity": 1, "item_id": item.id}],
    )
    r = client.post(f"/api/recipes/{recipe.id}/add-missing")
    # No rows added -- ingredient is "have"
    assert db_session.query(ShoppingListEntry).count() == 0


def test_add_missing_skips_duplicates(client, db_session):
    item = _make_item(db_session, name="Cheese", quantity=0, threshold=2)
    # Pre-existing shopping_list row for this item
    existing = ShoppingListEntry(item_id=item.id, added_manually=True, sort_order=1)
    db_session.add(existing)
    db_session.commit()

    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Cheese", "quantity": 1, "item_id": item.id}],
    )
    r = client.post(f"/api/recipes/{recipe.id}/add-missing")
    # Still only 1 row for this item
    count = db_session.query(ShoppingListEntry).filter_by(item_id=item.id).count()
    assert count == 1


# ---------------------------------------------------------------------------
# RECP-05 cook
# ---------------------------------------------------------------------------


def test_cook_deducts_exact_quantity(client, db_session):
    item = _make_item(db_session, name="Flour", quantity=10)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Flour", "quantity": 3, "item_id": item.id}],
    )
    ing = recipe.ingredients[0]
    r = client.post(
        f"/api/recipes/{recipe.id}/cook",
        json={"deductions": [{"ingredient_id": ing.id, "item_id": item.id, "amount": 3}]},
    )
    assert r.status_code == 200
    db_session.refresh(item)
    assert item.quantity == 7


def test_cook_steps_down_status_have_to_low(client, db_session):
    item = _make_item(
        db_session, name="Oil",
        quantity_mode=QuantityMode.STATUS, status=StockStatus.HAVE,
    )
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Oil", "quantity": None, "item_id": item.id}],
    )
    ing = recipe.ingredients[0]
    client.post(
        f"/api/recipes/{recipe.id}/cook",
        json={"deductions": [{"ingredient_id": ing.id, "item_id": item.id, "amount": 1}]},
    )
    db_session.refresh(item)
    assert item.status == StockStatus.LOW


def test_cook_steps_down_status_low_to_out(client, db_session):
    item = _make_item(
        db_session, name="Oil",
        quantity_mode=QuantityMode.STATUS, status=StockStatus.LOW,
    )
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Oil", "item_id": item.id}],
    )
    ing = recipe.ingredients[0]
    client.post(
        f"/api/recipes/{recipe.id}/cook",
        json={"deductions": [{"ingredient_id": ing.id, "item_id": item.id, "amount": 1}]},
    )
    db_session.refresh(item)
    assert item.status == StockStatus.OUT


def test_cook_status_out_stays_out(client, db_session):
    item = _make_item(
        db_session, name="Oil",
        quantity_mode=QuantityMode.STATUS, status=StockStatus.OUT,
    )
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Oil", "item_id": item.id}],
    )
    ing = recipe.ingredients[0]
    client.post(
        f"/api/recipes/{recipe.id}/cook",
        json={"deductions": [{"ingredient_id": ing.id, "item_id": item.id, "amount": 1}]},
    )
    db_session.refresh(item)
    assert item.status == StockStatus.OUT


def test_cook_writes_transaction_row(client, db_session):
    item = _make_item(db_session, name="X", quantity=5)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "X", "quantity": 1, "item_id": item.id}],
    )
    ing = recipe.ingredients[0]
    client.post(
        f"/api/recipes/{recipe.id}/cook",
        json={"deductions": [{"ingredient_id": ing.id, "item_id": item.id, "amount": 2}]},
    )
    txn = db_session.query(Transaction).filter_by(item_id=item.id, action="cook").first()
    assert txn is not None
    assert txn.delta == -2.0


def test_cook_skips_unlinked(client, db_session):
    # Recipe has one unlinked ingredient -- empty deductions list (client omits unlinked)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "Saffron", "quantity": 1, "item_id": None}],
    )
    r = client.post(f"/api/recipes/{recipe.id}/cook", json={"deductions": []})
    assert r.status_code == 200
    # No transaction rows created
    txns = db_session.query(Transaction).filter_by(action="cook").count()
    assert txns == 0


def test_cook_exact_quantity_clamp(client, db_session):
    item = _make_item(db_session, name="X", quantity=2)
    recipe = _make_recipe(
        db_session, name="R",
        ingredients=[{"name": "X", "quantity": 10, "item_id": item.id}],
    )
    ing = recipe.ingredients[0]
    client.post(
        f"/api/recipes/{recipe.id}/cook",
        json={"deductions": [{"ingredient_id": ing.id, "item_id": item.id, "amount": 10}]},
    )
    db_session.refresh(item)
    assert item.quantity == 0  # clamped, not negative
