"""Tests for MySQLConnector.

Unit tests run without a database.
Integration tests require a running MySQL and are marked with @pytest.mark.mysql.
"""

from __future__ import annotations

import pytest

from federated_rag.connector_mysql import (
    MySQLConnector,
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
    schema_name: str = "hr_db",
) -> TableSchema:
    if columns is None:
        columns = [
            ColumnSchema("id", "int", False, True, False),
            ColumnSchema("name", "varchar", False, False, False),
            ColumnSchema("dept_id", "int", True, False, True,
                         foreign_key_ref="departments.id"),
        ]
    return TableSchema(name=name, columns=columns, schema_name=schema_name)


# -----------------------------------------------------------------------
# Unit tests: rows_to_kg
# -----------------------------------------------------------------------


class TestRowsToKg:

    def test_single_row(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]
        rows = [{"id": 1, "name": "Alice", "dept_id": 10}]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols)

        assert len(kg["chunks"]) == 1
        assert kg["chunks"][0]["source_id"] == "employees__id=1"
        assert kg["entities"][0]["entity_name"] == "employees:1"
        assert "Alice" in kg["chunks"][0]["content"]

    def test_fk_relationship(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]
        rows = [{"id": 1, "name": "Alice", "dept_id": 10}]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols)

        assert len(kg["relationships"]) == 1
        assert kg["relationships"][0]["tgt_id"] == "departments:10"

    def test_null_fk_no_relationship(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        fk_cols = [c for c in table.columns if c.is_foreign_key]
        rows = [{"id": 1, "name": "Alice", "dept_id": None}]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols)
        assert len(kg["relationships"]) == 0

    def test_no_pk_uses_hash(self):
        columns = [ColumnSchema("value", "text", False, False, False)]
        table = _table(name="logs", columns=columns)
        rows = [{"value": "hello"}]

        kg = rows_to_kg(table, rows, pk_cols=[], fk_cols=[])
        assert kg["chunks"][0]["source_id"].startswith("logs__hash_")

    def test_file_path_format(self):
        table = _table(schema_name="mydb")
        pk_cols = [c for c in table.columns if c.is_primary_key]
        rows = [{"id": 1, "name": "A", "dept_id": None}]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols=[])
        assert kg["chunks"][0]["file_path"] == "mysql://mydb/employees"

    def test_multiple_rows(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        rows = [
            {"id": 1, "name": "Alice", "dept_id": None},
            {"id": 2, "name": "Bob", "dept_id": None},
        ]
        kg = rows_to_kg(table, rows, pk_cols, fk_cols=[])
        assert len(kg["chunks"]) == 2
        names = {e["entity_name"] for e in kg["entities"]}
        assert names == {"employees:1", "employees:2"}

    def test_null_excluded_from_content(self):
        table = _table()
        pk_cols = [c for c in table.columns if c.is_primary_key]
        rows = [{"id": 1, "name": None, "dept_id": None}]

        kg = rows_to_kg(table, rows, pk_cols, fk_cols=[])
        content = kg["chunks"][0]["content"]
        assert "id: 1" in content
        assert "name" not in content


# -----------------------------------------------------------------------
# Unit tests: find_timestamp_column
# -----------------------------------------------------------------------


class TestFindTimestampColumn:

    def test_finds_updated_at_datetime(self):
        columns = [
            ColumnSchema("id", "int", False, True, False),
            ColumnSchema("updated_at", "datetime", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) == "updated_at"

    def test_finds_updated_at_timestamp(self):
        columns = [
            ColumnSchema("id", "int", False, True, False),
            ColumnSchema("updated_at", "timestamp", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) == "updated_at"

    def test_returns_none_when_no_match(self):
        columns = [
            ColumnSchema("id", "int", False, True, False),
            ColumnSchema("created_at", "datetime", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) is None

    def test_ignores_non_datetime(self):
        columns = [
            ColumnSchema("updated_at", "varchar", True, False, False),
        ]
        table = _table(columns=columns)
        assert find_timestamp_column(table) is None


# -----------------------------------------------------------------------
# Unit tests: connector properties
# -----------------------------------------------------------------------


def test_connector_type():
    assert MySQLConnector.connector_type == ConnectorType.MYSQL


def test_default_batch_size():
    c = MySQLConnector()
    assert c._batch_size == 100


def test_custom_batch_size():
    c = MySQLConnector(batch_size=25)
    assert c._batch_size == 25
