"""Add recipes and recipe_ingredients tables; extend shopping_list for free-text entries.

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-19

Rationale (RESEARCH.md Pattern 1, Open Question 1):
  Phase 5 adds two new persistent entities for recipe storage. D-10 specifies
  that unlinked recipe ingredients are added to the shopping list as text
  entries — this requires shopping_list.item_id to become nullable and a
  new free_text column to accept the raw ingredient string.

Foreign key rules:
  - recipe_ingredients.recipe_id: ON DELETE CASCADE (deleting a recipe removes all its ingredients) — Pitfall 3
  - recipe_ingredients.item_id: ON DELETE SET NULL (deleting a linked inventory item leaves the ingredient intact but unlinked) — Pitfall 4
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. recipes
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # 2. recipe_ingredients
    op.create_table(
        "recipe_ingredients",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "recipe_id",
            sa.Integer(),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(), nullable=True),
        sa.Column(
            "item_id",
            sa.Integer(),
            sa.ForeignKey("items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=True),
    )

    # 3. shopping_list: add free_text, make item_id nullable
    with op.batch_alter_table("shopping_list", schema=None) as batch_op:
        batch_op.add_column(sa.Column("free_text", sa.String(), nullable=True))
        batch_op.alter_column(
            "item_id",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("shopping_list", schema=None) as batch_op:
        batch_op.drop_column("free_text")
        batch_op.alter_column(
            "item_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
    op.drop_table("recipe_ingredients")
    op.drop_table("recipes")
