"""Convert items.quantity and items.reorder_threshold from Float to Integer.

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-16

Rationale (UAT Gap 1):
  Quantities are conceptually integer counts of physical items in a household
  (3 cans, 2 bottles). The original Float type leaked into the edit drawer as
  "2.0". Switching to Integer eliminates the type mismatch at the data layer.

Pre-existing data note:
  Pre-existing fractional quantities (rare — no UI ever produced them) will be
  truncated by SQLite's INTEGER cast. This is acceptable per UAT Gap 1:
  quantities are conceptually integer counts.

  For household-scale DBs (<10k rows) the batch_alter_table rewrite is
  sub-second (mitigates T-02G-04).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("items", schema=None) as batch_op:
        batch_op.alter_column(
            "quantity",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "reorder_threshold",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("items", schema=None) as batch_op:
        batch_op.alter_column(
            "reorder_threshold",
            existing_type=sa.Integer(),
            type_=sa.Float(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "quantity",
            existing_type=sa.Integer(),
            type_=sa.Float(),
            existing_nullable=True,
        )
