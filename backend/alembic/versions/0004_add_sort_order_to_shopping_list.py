"""Add sort_order to shopping_list for drag-and-drop ordering (SHOP-01, D-05).

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-18

Rationale (RESEARCH.md Pitfall 1):
  The shopping_list table from migration 0001 has no sort_order column.
  Phase 4 drag-and-drop reordering requires a persistent sort_order per row.

Backfill:
  Existing rows (if any) are assigned sort_order = id so they retain
  insertion order after the upgrade. New rows get sort_order assigned
  by the API (max + 1).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("shopping_list", schema=None) as batch_op:
        batch_op.add_column(sa.Column("sort_order", sa.Integer(), nullable=True))

    # Backfill existing rows so initial ordering matches insertion order
    op.execute(
        "UPDATE shopping_list SET sort_order = id WHERE sort_order IS NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table("shopping_list", schema=None) as batch_op:
        batch_op.drop_column("sort_order")
