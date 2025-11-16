"""Ensure profiles table has active_persona_id column."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

try:
    from dotenv import load_dotenv
except ImportError: 
    load_dotenv = None

if load_dotenv:
    repo_root = Path(__file__).resolve().parents[2]
    for candidate in (
        repo_root / ".env",
        repo_root / "backend/.env",
    ):
        if candidate.exists():
            load_dotenv(candidate, override=False)

from backend.db import engine


CHECK_COLUMN_SQL = text(
    """
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = :table
      AND column_name = :column
    """
)

CHECK_FK_SQL = text(
    """
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = :table
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = :column
    """
)

ADD_COLUMN_SQL = text(
    """
    ALTER TABLE profiles
    ADD COLUMN active_persona_id UUID NULL
    """
)

ADD_CONSTRAINT_SQL = text(
    """
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_active_persona_id_fkey
    FOREIGN KEY (active_persona_id)
    REFERENCES personas(id)
    ON DELETE SET NULL
    """
)


def column_exists(conn) -> bool:
    result = conn.execute(
        CHECK_COLUMN_SQL,
        {"table": "profiles", "column": "active_persona_id"},
    )
    return result.first() is not None


def fk_exists(conn) -> bool:
    result = conn.execute(
        CHECK_FK_SQL,
        {"table": "profiles", "column": "active_persona_id"},
    )
    return result.first() is not None


def main() -> None:
    with engine.begin() as conn:
        if not column_exists(conn):
            conn.execute(ADD_COLUMN_SQL)
            print("Added profiles.active_persona_id column")
        else:
            print("profiles.active_persona_id already exists")

        if not fk_exists(conn):
            conn.execute(ADD_CONSTRAINT_SQL)
            print("Added profiles_active_persona_id_fkey constraint")
        else:
            print("Foreign key constraint already exists")


if __name__ == "__main__":
    main()
