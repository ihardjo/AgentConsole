"""Tests for MongoDBConnector.

Unit tests run without MongoDB.
Integration tests require a running MongoDB and are marked with @pytest.mark.mongo.
"""

from __future__ import annotations

from bson import ObjectId

import pytest

from federated_rag.connector_mongodb import (
    MongoDBConnector,
    _flatten_doc,
    _mongo_type,
    docs_to_kg,
    infer_columns,
)
from federated_rag.models import ColumnSchema, ConnectorType, TableSchema


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------


def _table(
    name: str = "users",
    columns: list[ColumnSchema] | None = None,
    schema_name: str = "testdb",
) -> TableSchema:
    if columns is None:
        columns = [
            ColumnSchema("_id", "ObjectId", False, True, False),
            ColumnSchema("name", "string", False, False, False),
            ColumnSchema("age", "int", True, False, False),
        ]
    return TableSchema(name=name, columns=columns, schema_name=schema_name)


# -----------------------------------------------------------------------
# Unit tests: _flatten_doc
# -----------------------------------------------------------------------


class TestFlattenDoc:

    def test_flat_document(self):
        doc = {"name": "Alice", "age": 30}
        assert _flatten_doc(doc) == {"name": "Alice", "age": 30}

    def test_nested_document(self):
        doc = {"name": "Alice", "address": {"city": "NYC", "zip": "10001"}}
        flat = _flatten_doc(doc)
        assert flat == {
            "name": "Alice",
            "address.city": "NYC",
            "address.zip": "10001",
        }

    def test_deeply_nested(self):
        doc = {"a": {"b": {"c": 1}}}
        assert _flatten_doc(doc) == {"a.b.c": 1}

    def test_preserves_arrays(self):
        doc = {"tags": ["a", "b"]}
        assert _flatten_doc(doc) == {"tags": ["a", "b"]}

    def test_preserves_dollar_prefixed_keys(self):
        doc = {"query": {"$gt": 5}}
        assert _flatten_doc(doc) == {"query": {"$gt": 5}}


# -----------------------------------------------------------------------
# Unit tests: _mongo_type
# -----------------------------------------------------------------------


class TestMongoType:

    def test_none(self):
        assert _mongo_type(None) == "null"

    def test_bool(self):
        assert _mongo_type(True) == "bool"

    def test_int(self):
        assert _mongo_type(42) == "int"

    def test_float(self):
        assert _mongo_type(3.14) == "double"

    def test_string(self):
        assert _mongo_type("hello") == "string"

    def test_list(self):
        assert _mongo_type([1, 2]) == "array"

    def test_dict(self):
        assert _mongo_type({"a": 1}) == "object"


# -----------------------------------------------------------------------
# Unit tests: infer_columns
# -----------------------------------------------------------------------


class TestInferColumns:

    def test_basic_inference(self):
        sample = [
            {"_id": "1", "name": "Alice", "age": 30},
            {"_id": "2", "name": "Bob", "age": 25},
        ]
        cols = infer_columns(sample)
        col_map = {c.name: c for c in cols}

        assert col_map["_id"].is_primary_key is True
        assert col_map["_id"].data_type == "string"
        assert col_map["name"].data_type == "string"
        assert col_map["age"].data_type == "int"
        assert col_map["name"].nullable is False  # present in all docs

    def test_nullable_detection(self):
        sample = [
            {"_id": "1", "name": "Alice", "email": "a@x.com"},
            {"_id": "2", "name": "Bob"},  # missing email
        ]
        cols = infer_columns(sample)
        col_map = {c.name: c for c in cols}

        assert col_map["email"].nullable is True
        assert col_map["name"].nullable is False

    def test_mixed_types(self):
        sample = [
            {"_id": "1", "value": 42},
            {"_id": "2", "value": "text"},
        ]
        cols = infer_columns(sample)
        col_map = {c.name: c for c in cols}
        # Should show both types
        assert "int" in col_map["value"].data_type
        assert "string" in col_map["value"].data_type

    def test_nested_fields_flattened(self):
        sample = [
            {"_id": "1", "address": {"city": "NYC", "zip": "10001"}},
        ]
        cols = infer_columns(sample)
        col_names = {c.name for c in cols}
        assert "address.city" in col_names
        assert "address.zip" in col_names

    def test_empty_sample(self):
        assert infer_columns([]) == []


# -----------------------------------------------------------------------
# Unit tests: docs_to_kg
# -----------------------------------------------------------------------


class TestDocsToKg:

    def test_single_doc(self):
        table = _table()
        docs = [{"_id": "abc123", "name": "Alice", "age": 30}]

        kg = docs_to_kg(table, docs)

        assert len(kg["chunks"]) == 1
        assert len(kg["entities"]) == 1
        assert kg["chunks"][0]["source_id"] == "users__id=abc123"
        assert kg["entities"][0]["entity_name"] == "users:abc123"
        assert "Alice" in kg["chunks"][0]["content"]
        assert kg["relationships"] == []

    def test_multiple_docs(self):
        table = _table()
        docs = [
            {"_id": "1", "name": "Alice", "age": 30},
            {"_id": "2", "name": "Bob", "age": 25},
        ]
        kg = docs_to_kg(table, docs)
        assert len(kg["chunks"]) == 2
        names = {e["entity_name"] for e in kg["entities"]}
        assert names == {"users:1", "users:2"}

    def test_doc_without_id_uses_hash(self):
        table = _table()
        docs = [{"name": "Alice"}]

        kg = docs_to_kg(table, docs)
        assert kg["chunks"][0]["source_id"].startswith("users__hash_")
        assert kg["entities"][0]["entity_name"].startswith("users:hash_")

    def test_file_path(self):
        table = _table(schema_name="mydb")
        docs = [{"_id": "1", "name": "test"}]

        kg = docs_to_kg(table, docs)
        assert kg["chunks"][0]["file_path"] == "mongodb://mydb/users"

    def test_id_excluded_from_content(self):
        table = _table()
        docs = [{"_id": "secret_id", "name": "Alice"}]

        kg = docs_to_kg(table, docs)
        content = kg["chunks"][0]["content"]
        assert "_id" not in content
        assert "Alice" in content

    def test_objectid_as_id(self):
        table = _table()
        oid = ObjectId("507f1f77bcf86cd799439011")
        docs = [{"_id": oid, "name": "Alice"}]

        kg = docs_to_kg(table, docs)
        assert "507f1f77bcf86cd799439011" in kg["chunks"][0]["source_id"]


# -----------------------------------------------------------------------
# Unit tests: connector properties
# -----------------------------------------------------------------------


def test_connector_type():
    assert MongoDBConnector.connector_type == ConnectorType.MONGODB


def test_default_batch_size():
    c = MongoDBConnector()
    assert c._batch_size == 100
    assert c._sample_size == 100


def test_custom_sizes():
    c = MongoDBConnector(batch_size=50, sample_size=25)
    assert c._batch_size == 50
    assert c._sample_size == 25
