"""MySQL connector with auto schema extraction and content streaming.

Connects to MySQL via aiomysql, extracts INFORMATION_SCHEMA metadata
(tables, columns, primary keys, foreign keys), and streams table rows
as LightRAG-compatible custom KG batches.

See: Architecture Plan Section 4.1.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

import aiomysql

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
SELECT TABLE_SCHEMA, TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = %s
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME
"""

_SQL_COLUMNS = """
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = %s
ORDER BY TABLE_NAME, ORDINAL_POSITION
"""

_SQL_PRIMARY_KEYS = """
SELECT tc.TABLE_NAME, kcu.COLUMN_NAME
FROM information_schema.TABLE_CONSTRAINTS tc
JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  AND tc.TABLE_SCHEMA = %s
"""

_SQL_FOREIGN_KEYS = """
SELECT
    kcu.TABLE_NAME       AS from_table,
    kcu.COLUMN_NAME      AS from_column,
    kcu.REFERENCED_TABLE_NAME  AS to_table,
    kcu.REFERENCED_COLUMN_NAME AS to_column
FROM information_schema.KEY_COLUMN_USAGE kcu
WHERE kcu.TABLE_SCHEMA = %s
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
"""

_SQL_ROW_COUNTS = """
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = %s
  AND TABLE_TYPE = 'BASE TABLE'
"""


class MySQLConnector(BaseConnector):
    """MySQL connector using aiomysql with connection pooling.

    Extracts schema via INFORMATION_SCHEMA and streams table rows as
    custom KG dicts for LightRAG ingestion.
    """

    connector_type = ConnectorType.MYSQL

    def __init__(self, batch_size: int = BATCH_SIZE) -> None:
        self._pool: aiomysql.Pool | None = None
        self._config: dict[str, Any] | None = None
        self._batch_size = batch_size
        self._schema_cache: InformationSchema | None = None

    # ------------------------------------------------------------------
    # BaseConnector interface
    # ------------------------------------------------------------------

    async def connect(self, config: dict[str, Any]) -> bool:
        """Create an aiomysql connection pool.

        Required config keys: host, user, password, database.
        Optional: port (default 3306), max_connections (default 5).
        """
        try:
            self._config = config
            self._pool = await aiomysql.create_pool(
                host=config["host"],
                port=config.get("port", 3306),
                user=config["user"],
                password=config["password"],
                db=config["database"],
                minsize=1,
                maxsize=config.get("max_connections", 5),
                autocommit=True,
            )
            return True
        except Exception:
            self._pool = None
            return False

    async def disconnect(self) -> None:
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None
        self._config = None
        self._schema_cache = None

    async def test_connection(self) -> bool:
        if not self._pool:
            return False
        try:
            async with self._pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
            return True
        except Exception:
            return False

    async def extract_schema(self) -> InformationSchema:
        """Query INFORMATION_SCHEMA for tables, columns, PKs, and FKs."""
        if not self._pool or not self._config:
            raise RuntimeError("Not connected. Call connect() first.")

        db_name = self._config["database"]

        async with self._pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(_SQL_TABLES, (db_name,))
                table_rows = await cur.fetchall()

                await cur.execute(_SQL_COLUMNS, (db_name,))
                column_rows = await cur.fetchall()

                await cur.execute(_SQL_PRIMARY_KEYS, (db_name,))
                pk_rows = await cur.fetchall()

                await cur.execute(_SQL_FOREIGN_KEYS, (db_name,))
                fk_rows = await cur.fetchall()

                await cur.execute(_SQL_ROW_COUNTS, (db_name,))
                count_rows = await cur.fetchall()

        pk_set: set[tuple[str, str]] = {
            (r["TABLE_NAME"], r["COLUMN_NAME"]) for r in pk_rows
        }

        fk_map: dict[tuple[str, str], str] = {}
        for r in fk_rows:
            fk_map[(r["from_table"], r["from_column"])] = (
                f"{r['to_table']}.{r['to_column']}"
            )

        count_map: dict[str, int] = {
            r["TABLE_NAME"]: int(r["TABLE_ROWS"] or 0) for r in count_rows
        }

        cols_by_table: dict[str, list] = defaultdict(list)
        for cr in column_rows:
            cols_by_table[cr["TABLE_NAME"]].append(cr)

        tables: list[TableSchema] = []
        for tr in table_rows:
            tname = tr["TABLE_NAME"]
            columns = [
                ColumnSchema(
                    name=cr["COLUMN_NAME"],
                    data_type=cr["DATA_TYPE"],
                    nullable=cr["IS_NULLABLE"] == "YES",
                    is_primary_key=(tname, cr["COLUMN_NAME"]) in pk_set,
                    is_foreign_key=(tname, cr["COLUMN_NAME"]) in fk_map,
                    default_value=str(cr["COLUMN_DEFAULT"]) if cr["COLUMN_DEFAULT"] is not None else None,
                    foreign_key_ref=fk_map.get((tname, cr["COLUMN_NAME"])),
                )
                for cr in cols_by_table.get(tname, [])
            ]
            tables.append(
                TableSchema(
                    name=tname,
                    columns=columns,
                    schema_name=db_name,
                    row_count=count_map.get(tname, 0),
                )
            )

        info = InformationSchema(
            source_id=db_name,
            source_type=ConnectorType.MYSQL,
            tables=tables,
            raw_schema={
                "tables": table_rows,
                "columns": column_rows,
                "primary_keys": pk_rows,
                "foreign_keys": fk_rows,
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

        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]

        query = f"SELECT * FROM `{table.name}`"
        params: list[Any] = []

        if since:
            ts_col = find_timestamp_column(table)
            if ts_col:
                query += f" WHERE `{ts_col}` > %s"
                params.append(since)

        if pk_cols:
            order = ", ".join(f"`{c.name}`" for c in pk_cols)
            query += f" ORDER BY {order}"

        async with self._pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                offset = 0
                while True:
                    batch_query = f"{query} LIMIT {self._batch_size} OFFSET {offset}"
                    await cur.execute(batch_query, params)
                    rows = await cur.fetchall()
                    if not rows:
                        break

                    yield rows_to_kg(table, rows, pk_cols, fk_cols)
                    offset += self._batch_size

                    if len(rows) < self._batch_size:
                        break


# ----------------------------------------------------------------------
# Pure helper functions (testable without a database)
# ----------------------------------------------------------------------


def rows_to_kg(
    table: TableSchema,
    rows: list[dict],
    pk_cols: list[ColumnSchema],
    fk_cols: list[ColumnSchema],
) -> dict[str, Any]:
    """Convert a batch of MySQL rows to LightRAG custom KG format."""
    chunks: list[dict[str, Any]] = []
    entities: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []
    db_name = table.schema_name or "mysql"
    file_path = f"mysql://{db_name}/{table.name}"

    for row in rows:
        if pk_cols:
            pk_parts = [f"{c.name}={row[c.name]}" for c in pk_cols]
            chunk_id = f"{table.name}__{'_'.join(pk_parts)}"
            pk_vals = "_".join(str(row[c.name]) for c in pk_cols)
            entity_name = f"{table.name}:{pk_vals}"
        else:
            row_hash = hashlib.md5(
                json.dumps(row, default=str, sort_keys=True).encode(),
            ).hexdigest()[:8]
            chunk_id = f"{table.name}__hash_{row_hash}"
            entity_name = f"{table.name}:hash_{row_hash}"

        col_texts = [
            f"{col.name}: {row[col.name]}"
            for col in table.columns
            if row.get(col.name) is not None
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
            fk_val = row.get(fk_col.name)
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
        if col.name.lower() in candidates and col.data_type.lower() in (
            "datetime", "timestamp",
        ):
            return col.name
    return None
