"""Tests for RESTAPIConnector -- unit tests only (no external API needed)."""

from __future__ import annotations

import pytest

from federated_rag.connector_rest_api import (
    RESTAPIConnector,
    _extract_items,
    responses_to_kg,
)
from federated_rag.models import ConnectorType


# -----------------------------------------------------------------------
# Unit tests: _extract_items
# -----------------------------------------------------------------------


class TestExtractItems:

    def test_list_at_root(self):
        data = [{"id": 1}, {"id": 2}]
        assert _extract_items(data) == [{"id": 1}, {"id": 2}]

    def test_nested_path(self):
        data = {"response": {"data": [{"id": 1}]}}
        assert _extract_items(data, "response.data") == [{"id": 1}]

    def test_single_object_wrapped(self):
        data = {"id": 1, "name": "Alice"}
        assert _extract_items(data) == [{"id": 1, "name": "Alice"}]

    def test_missing_path_returns_empty(self):
        data = {"response": {"other": []}}
        assert _extract_items(data, "response.data") == []

    def test_none_path_uses_root(self):
        data = [{"id": 1}]
        assert _extract_items(data, None) == [{"id": 1}]

    def test_empty_list(self):
        assert _extract_items([]) == []

    def test_non_dict_non_list_returns_empty(self):
        assert _extract_items("string") == []


# -----------------------------------------------------------------------
# Unit tests: responses_to_kg
# -----------------------------------------------------------------------


class TestResponsesToKg:

    def test_items_with_id(self):
        items = [{"id": 1, "name": "Alice", "role": "Engineer"}]
        kg = responses_to_kg("users", items, "api.example.com")

        assert len(kg["chunks"]) == 1
        assert kg["chunks"][0]["source_id"] == "users__id=1"
        assert kg["entities"][0]["entity_name"] == "users:1"
        assert "Alice" in kg["chunks"][0]["content"]
        assert kg["chunks"][0]["file_path"] == "rest_api://api.example.com/users"

    def test_items_without_id_use_hash(self):
        items = [{"name": "Alice"}]
        kg = responses_to_kg("users", items)

        assert kg["chunks"][0]["source_id"].startswith("users__hash_")

    def test_multiple_items(self):
        items = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        kg = responses_to_kg("users", items)

        assert len(kg["chunks"]) == 2
        names = {e["entity_name"] for e in kg["entities"]}
        assert names == {"users:1", "users:2"}

    def test_empty_items(self):
        kg = responses_to_kg("users", [])
        assert kg["chunks"] == []
        assert kg["entities"] == []
        assert kg["relationships"] == []

    def test_id_excluded_from_content(self):
        items = [{"id": 42, "name": "Alice"}]
        kg = responses_to_kg("users", items)
        content = kg["chunks"][0]["content"]
        assert "name: Alice" in content
        # id should be excluded from field texts
        assert "id:" not in content


# -----------------------------------------------------------------------
# Connector properties
# -----------------------------------------------------------------------


def test_connector_type():
    assert RESTAPIConnector.connector_type == ConnectorType.REST_API
