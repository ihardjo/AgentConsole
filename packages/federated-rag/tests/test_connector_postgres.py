"""Tests for PostgreSQLConnector.

Unit tests run without a database.
Integration tests require `docker-compose up -d` and are marked with @pytest.mark.pg.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from federated_rag.connector_postgres import (
    PostgreSQLConnector,
    find_timestamp_column,
    rows_to_kg,
)
from federated_rag.models import ColumnSchema, ConnectorType, TableSchema


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------


def _table(
    name: str = "employees",
    columns: list[ColumnSchema] | None = None,
    schema_name: str = "public",
) -> TableSchema:
    if columns is None:
        columns = [
            ColumnSchema("id", "integer", False, True, False),
            ColumnSchema("name", "character varying", False, False, False),
            ColumnSchema("dept_id", "integer", True, False, True,
                         foreign_key_ref="departments.id"),
        ]
    return TableSchema(name=name, columns=columns, schema_name=schema_name)


def _row(**kv) -> dict:
    """Simulate an asyncpg Record (dict-like)."""
    return kv


# -----------------------------------------------------------------------
# Unit tests: rows_to_kg
# -----------------------------------------------------------------------


class TestRowsToKg:

    def test_single_row_produces_chunk_and_entity(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]
        rows = [_row(id=1, name="Alice", dept_id=10)]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols)

        assert len(kg["chunks"]) == 1
        assert len(kg["entities"]) == 1
        assert kg["chunks"][0]["source_id"] == "employees__id=1"
        assert "Alice" in kg["chunks"][0]["content"]
        assert kg["entities"][0]["entity_name"] == "employees:1"
        assert kg["entities"][0]["entity_type"] == "employees"

    def test_multiple_rows(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]
        rows = [
            _row(id=1, name="Alice", dept_id=10),
            _row(id=2, name="Bob", dept_id=20),
        ]
        kg = rows_to_kg(table, rows, pk_cols, fk_cols)

        assert len(kg["chunks"]) == 2
        assert len(kg["entities"]) == 2
        names = {e["entity_name"] for e in kg["entities"]}
        assert names == {"employees:1", "employees:2"}

    def test_fk_creates_relationship(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]
        rows = [_row(id=1, name="Alice", dept_id=10)]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols)

        assert len(kg["relationships"]) == 1
        rel = kg["relationships"][0]
        assert rel["src_id"] == "employees:1"
        assert rel["tgt_id"] == "departments:10"
        assert "foreign key" in rel["keywords"]

    def test_null_fk_skips_relationship(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]
        rows = [_row(id=1, name="Alice", dept_id=None)]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols)
        assert len(kg["relationships"]) == 0

    def test_composite_pk(self):
        columns = [
            ColumnSchema("order_id", "integer", False, True, False),
            ColumnSchema("item_id", "integer", False, True, False),
            ColumnSchema("quantity", "integer", False, False, False),
        ]
        table = _table(name="order_items", columns=columns)
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = []
        rows = [_row(order_id=100, item_id=5, quantity=3)]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols)

        assert kg["chunks"][0]["source_id"] == "order_items__order_id=100_item_id=5"
        assert kg["entities"][0]["entity_name"] == "order_items:100_5"

    def test_no_pk_uses_hash(self):
        columns = [
            ColumnSchema("value", "text", False, False, False),
        ]
        table = _table(name="logs", columns=columns)
        rows = [_row(value="hello")]

        kg = rows_to_kg(table, rows, pk_cols=[], fk_cols=[])

        assert kg["chunks"][0]["source_id"].startswith("logs__hash_")
        assert kg["entities"][0]["entity_name"].startswith("logs:hash_")

    def test_null_columns_excluded_from_content(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        rows = [_row(id=1, name=None, dept_id=None)]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols=[])

        content = kg["chunks"][0]["content"]
        assert "id: 1" in content
        assert "name" not in content
        assert "dept_id" not in content

    def test_file_path_includes_schema_and_table(self):
        table = _table(schema_name="hr")
        pk_cols = [c for c in table.columns if c.is_primary_key]
        rows = [_row(id=1, name="A", dept_id=1)]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols=[])
        assert kg["chunks"][0]["file_path"] == "postgresql://hr/employees"


# -----------------------------------------------------------------------
# Unit tests: find_timestamp_column
# -----------------------------------------------------------------------


class TestFindTimestampColumn:

    def test_finds_updated_at(self):
        columns = [
            ColumnSchema("id", "integer", False, True, False),
            ColumnSchema("updated_at", "timestamp with time zone", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) == "updated_at"

    def test_finds_modified_at(self):
        columns = [
            ColumnSchema("id", "integer", False, True, False),
            ColumnSchema("modified_at", "timestamp without time zone", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) == "modified_at"

    def test_returns_none_when_no_match(self):
        columns = [
            ColumnSchema("id", "integer", False, True, False),
            ColumnSchema("created_at", "timestamp with time zone", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) is None

    def test_ignores_non_timestamp_updated_at(self):
        columns = [
            ColumnSchema("updated_at", "text", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) is None


# -----------------------------------------------------------------------
# Unit tests: connector properties
# -----------------------------------------------------------------------


def test_connector_type():
    assert PostgreSQLConnector.connector_type == ConnectorType.POSTGRESQL


def test_default_batch_size():
    c = PostgreSQLConnector()
    assert c._batch_size == 100


def test_custom_batch_size():
    c = PostgreSQLConnector(batch_size=50)
    assert c._batch_size == 50


# -----------------------------------------------------------------------
# Integration tests (require running PostgreSQL)
# -----------------------------------------------------------------------


@pytest.mark.pg
async def test_connect_and_test(pg_config):
    c = PostgreSQLConnector()
    assert await c.connect(pg_config) is True
    assert await c.test_connection() is True
    await c.disconnect()
    assert await c.test_connection() is False


@pytest.mark.pg
async def test_connect_bad_credentials():
    c = PostgreSQLConnector()
    result = await c.connect({
        "host": "localhost", "port": 5440,
        "user": "nonexistent", "password": "wrong",
        "database": "nope",
    })
    assert result is False


@pytest.mark.pg
async def test_extract_schema(pg_config):
    c = PostgreSQLConnector()
    await c.connect(pg_config)
    try:
        schema = await c.extract_schema()
        assert schema.source_type == ConnectorType.POSTGRESQL
        assert len(schema.tables) > 0
        for table in schema.tables:
            assert len(table.columns) > 0
    finally:
        await c.disconnect()


@pytest.mark.pg
async def test_list_resources(pg_config):
    c = PostgreSQLConnector()
    await c.connect(pg_config)
    try:
        resources = await c.list_resources()
        assert len(resources) > 0
        assert all(r["type"] == "table" for r in resources)
        assert all("row_count" in r for r in resources)
    finally:
        await c.disconnect()


@pytest.mark.pg
async def test_extract_content(pg_config):
    c = PostgreSQLConnector(batch_size=10)
    await c.connect(pg_config)
    try:
        batches = []
        async for batch in c.extract_content():
            batches.append(batch)
            assert "chunks" in batch
            assert "entities" in batch
            assert "relationships" in batch

        assert len(batches) > 0
    finally:
        await c.disconnect()


@pytest.mark.pg
async def test_extract_content_with_filter(pg_config):
    c = PostgreSQLConnector()
    await c.connect(pg_config)
    try:
        schema = await c.extract_schema()
        if schema.tables:
            target = schema.tables[0].name
            batches = []
            async for batch in c.extract_content(resource_filter=[target]):
                batches.append(batch)
            # All chunks should be from the target table
            for batch in batches:
                for chunk in batch["chunks"]:
                    assert target in chunk["source_id"]
    finally:
        await c.disconnect()
