"""Add is_default column to categories and seed 4 default categories.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-15

References:
  - D-04 (Settings-only management): custom categories are managed via /settings only;
    the 4 default categories below are pre-loaded and cannot be deleted by users.
  - ORG-01 (default categories pre-loaded): Food & pantry, Fridge & freezer,
    Cleaning & household, and Personal care are seeded here so every fresh install
    has a working category set out of the box.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table is REQUIRED for SQLite ADD COLUMN NOT NULL to work.
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_default",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )

    # Seed the 4 default categories (INSERT OR IGNORE is idempotent).
    op.execute(
        "INSERT OR IGNORE INTO categories (name, is_default) VALUES "
        "('Food & pantry', 1), "
        "('Fridge & freezer', 1), "
        "('Cleaning & household', 1), "
        "('Personal care', 1)"
    )


def downgrade() -> None:
    # Remove seeded rows before dropping the column so the downgrade is clean.
    op.execute("DELETE FROM categories WHERE is_default = 1")

    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.drop_column("is_default")
