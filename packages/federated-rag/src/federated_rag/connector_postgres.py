"""PostgreSQL connector with auto schema extraction and content streaming.

Connects to a PostgreSQL database via asyncpg, extracts INFORMATION_SCHEMA
metadata (tables, columns, primary keys, foreign keys), and streams table
rows as LightRAG-compatible custom KG batches.

See: Architecture Plan Section 4.1 and 5.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

import asyncpg

from federated_rag.connector_base import BaseConnector
from federated_rag.models import (
    ColumnSchema,
    ConnectorType,
    InformationSchema,
    TableSchema,
)

BATCH_SIZE = 100

# ---------------------------------------------------------------------------
# INFORMATION_SCHEMA queries
# ---------------------------------------------------------------------------

_SQL_TABLES = """
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'age_catalog')
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name
"""

_SQL_COLUMNS = """
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = $1
ORDER BY table_name, ordinal_position
"""

_SQL_PRIMARY_KEYS = """
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = $1
"""

_SQL_FOREIGN_KEYS = """
SELECT
    kcu.table_name   AS from_table,
    kcu.column_name  AS from_column,
    ccu.table_name   AS to_table,
    ccu.column_name  AS to_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = $1
"""

_SQL_ROW_COUNTS = """
SELECT schemaname, relname AS table_name,
       n_live_tup::bigint AS row_count
FROM pg_stat_user_tables
WHERE schemaname = $1
ORDER BY relname
"""


class PostgreSQLConnector(BaseConnector):
    """PostgreSQL connector using asyncpg with connection pooling.

    Extracts schema via INFORMATION_SCHEMA and streams table rows as
    custom KG dicts for LightRAG ingestion.
    """

    connector_type = ConnectorType.POSTGRESQL

    def __init__(self, batch_size: int = BATCH_SIZE) -> None:
        self._pool: asyncpg.Pool | None = None
        self._config: dict[str, Any] | None = None
        self._batch_size = batch_size
        self._schema_cache: InformationSchema | None = None

    # ------------------------------------------------------------------
    # BaseConnector interface
    # ------------------------------------------------------------------

    async def connect(self, config: dict[str, Any]) -> bool:
        """Create an asyncpg connection pool.

        Required config keys: host, user, password, database.
        Optional: port (default 5432), schema (default 'public'),
                  max_connections (default 5).
        """
        try:
            self._config = config
            self._pool = await asyncpg.create_pool(
                host=config["host"],
                port=config.get("port", 5432),
                user=config["user"],
                password=config["password"],
                database=config["database"],
                min_size=1,
                max_size=config.get("max_connections", 5),
            )
            return True
        except Exception:
            self._pool = None
            return False

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None
        self._config = None
        self._schema_cache = None

    async def test_connection(self) -> bool:
        if not self._pool:
            return False
        try:
            async with self._pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception:
            return False

    async def extract_schema(self) -> InformationSchema:
        """Query INFORMATION_SCHEMA for tables, columns, PKs, and FKs."""
        if not self._pool or not self._config:
            raise RuntimeError("Not connected. Call connect() first.")

        schema_name = self._config.get("schema", "public")

        async with self._pool.acquire() as conn:
            table_rows = await conn.fetch(_SQL_TABLES)
            column_rows = await conn.fetch(_SQL_COLUMNS, schema_name)
            pk_rows = await conn.fetch(_SQL_PRIMARY_KEYS, schema_name)
            fk_rows = await conn.fetch(_SQL_FOREIGN_KEYS, schema_name)
            count_rows = await conn.fetch(_SQL_ROW_COUNTS, schema_name)

        tables_in_schema = [
            r for r in table_rows if r["table_schema"] == schema_name
        ]

        pk_set: set[tuple[str, str]] = {
            (r["table_name"], r["column_name"]) for r in pk_rows
        }

        fk_map: dict[tuple[str, str], str] = {}
        for r in fk_rows:
            fk_map[(r["from_table"], r["from_column"])] = (
                f"{r['to_table']}.{r['to_column']}"
            )

        count_map: dict[str, int] = {
            r["table_name"]: int(r["row_count"]) for r in count_rows
        }

        cols_by_table: dict[str, list] = defaultdict(list)
        for cr in column_rows:
            cols_by_table[cr["table_name"]].append(cr)

        tables: list[TableSchema] = []
        for tr in tables_in_schema:
            tname = tr["table_name"]
            columns = [
                ColumnSchema(
                    name=cr["column_name"],
                    data_type=cr["data_type"],
                    nullable=cr["is_nullable"] == "YES",
                    is_primary_key=(tname, cr["column_name"]) in pk_set,
                    is_foreign_key=(tname, cr["column_name"]) in fk_map,
                    default_value=cr["column_default"],
                    foreign_key_ref=fk_map.get((tname, cr["column_name"])),
                )
                for cr in cols_by_table.get(tname, [])
            ]
            tables.append(
                TableSchema(
                    name=tname,
                    columns=columns,
                    schema_name=schema_name,
                    row_count=count_map.get(tname, 0),
                )
            )

        info = InformationSchema(
            source_id=self._config.get("database", "unknown"),
            source_type=ConnectorType.POSTGRESQL,
            tables=tables,
            raw_schema={
                "tables": [dict(r) for r in table_rows],
                "columns": [dict(r) for r in column_rows],
                "primary_keys": [dict(r) for r in pk_rows],
                "foreign_keys": [dict(r) for r in fk_rows],
            },
            extracted_at=datetime.now(tz=timezone.utc),
        )
        self._schema_cache = info
        return info

    async def extract_content(
        self,
        resource_filter: Optional[list[str]] = None,
        since: Optional[datetime] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield custom KG batches, one per table chunk."""
        if not self._schema_cache:
            await self.extract_schema()
        assert self._schema_cache is not None

        for table in self._schema_cache.tables:
            if resource_filter and table.name not in resource_filter:
                continue
            async for batch_kg in self._stream_table(table, since):
                yield batch_kg

    async def list_resources(self) -> list[dict[str, Any]]:
        if not self._schema_cache:
            await self.extract_schema()
        assert self._schema_cache is not None

        return [
            {
                "name": t.name,
                "type": "table",
                "schema": t.schema_name,
                "row_count": t.row_count,
                "column_count": len(t.columns),
            }
            for t in self._schema_cache.tables
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _stream_table(
        self, table: TableSchema, since: Optional[datetime],
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream rows from a single table in batches."""
        assert self._pool is not None
        schema_name = table.schema_name or "public"
        qualified = f'"{schema_name}"."{table.name}"'

        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]

        query = f"SELECT * FROM {qualified}"
        params: list[Any] = []

        if since:
            ts_col = find_timestamp_column(table)
            if ts_col:
                query += f' WHERE "{ts_col}" > $1'
                params.append(since)

        if pk_cols:
            order = ", ".join(f'"{c.name}"' for c in pk_cols)
            query += f" ORDER BY {order}"

        async with self._pool.acquire() as conn:
            offset = 0
            while True:
                batch_query = f"{query} LIMIT {self._batch_size} OFFSET {offset}"
                rows = await conn.fetch(batch_query, *params)
                if not rows:
                    break

                yield rows_to_kg(table, rows, pk_cols, fk_cols)
                offset += self._batch_size

                if len(rows) < self._batch_size:
                    break


# ----------------------------------------------------------------------
# Pure helper functions (easily testable without a database)
# ----------------------------------------------------------------------


def rows_to_kg(
    table: TableSchema,
    rows: list,
    pk_cols: list[ColumnSchema],
    fk_cols: list[ColumnSchema],
) -> dict[str, Any]:
    """Convert a batch of rows to LightRAG custom KG format.

    Each row produces one chunk + one entity.
    FK columns produce relationships to referenced entities.
    """
    chunks: list[dict[str, Any]] = []
    entities: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []
    schema_name = table.schema_name or "public"
    file_path = f"postgresql://{schema_name}/{table.name}"

    for row in rows:
        row_dict = dict(row)

        if pk_cols:
            pk_parts = [f"{c.name}={row_dict[c.name]}" for c in pk_cols]
            chunk_id = f"{table.name}__{'_'.join(pk_parts)}"
            pk_vals = "_".join(str(row_dict[c.name]) for c in pk_cols)
            entity_name = f"{table.name}:{pk_vals}"
        else:
            row_hash = hashlib.md5(
                json.dumps(row_dict, default=str, sort_keys=True).encode(),
            ).hexdigest()[:8]
            chunk_id = f"{table.name}__hash_{row_hash}"
            entity_name = f"{table.name}:hash_{row_hash}"

        col_texts = [
            f"{col.name}: {row_dict[col.name]}"
            for col in table.columns
            if row_dict.get(col.name) is not None
        ]
        content = f"{table.name} record — " + ", ".join(col_texts)

        chunks.append({
            "source_id": chunk_id,
            "content": content,
            "file_path": file_path,
            "chunk_order_index": 0,
        })

        entities.append({
            "entity_name": entity_name,
            "entity_type": table.name,
            "description": content,
            "source_id": chunk_id,
            "file_path": file_path,
        })

        for fk_col in fk_cols:
            fk_val = row_dict.get(fk_col.name)
            if fk_val is not None and fk_col.foreign_key_ref:
                ref_table = fk_col.foreign_key_ref.split(".", 1)[0]
                relationships.append({
                    "src_id": entity_name,
                    "tgt_id": f"{ref_table}:{fk_val}",
                    "description": (
                        f"{table.name}.{fk_col.name} references "
                        f"{fk_col.foreign_key_ref}"
                    ),
                    "keywords": f"{fk_col.name}, foreign key, {ref_table}",
                    "source_id": chunk_id,
                    "weight": 1.0,
                    "file_path": file_path,
                })

    return {
        "chunks": chunks,
        "entities": entities,
        "relationships": relationships,
    }


def find_timestamp_column(table: TableSchema) -> str | None:
    """Find a timestamp column suitable for incremental sync."""
    candidates = {"updated_at", "modified_at", "last_modified", "updated"}
    for col in table.columns:
        if col.name.lower() in candidates and "timestamp" in col.data_type.lower():
            return col.name
    return None
