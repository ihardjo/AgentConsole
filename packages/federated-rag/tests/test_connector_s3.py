"""Tests for S3Connector -- unit tests for pure helper functions."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from federated_rag.connector_s3 import (
    S3Connector,
    SUPPORTED_EXTENSIONS,
    object_to_kg,
)
from federated_rag.models import ConnectorType


# -----------------------------------------------------------------------
# Unit tests: object_to_kg
# -----------------------------------------------------------------------


class TestObjectToKg:

    def test_basic_object(self):
        kg = object_to_kg(
            "data/report.pdf",
            {"Key": "data/report.pdf", "Size": 1024, "LastModified": "2026-04-26"},
            "my-bucket",
        )

        assert len(kg["chunks"]) == 1
        assert len(kg["entities"]) == 1
        assert kg["chunks"][0]["file_path"] == "s3://my-bucket/data/report.pdf"
        assert "report.pdf" in kg["chunks"][0]["content"]
        assert "1024" in kg["chunks"][0]["content"]
        assert kg["entities"][0]["entity_type"] == "s3_object"

    def test_entity_name_uses_filename(self):
        kg = object_to_kg("folder/file.csv", {"Size": 0}, "bucket")
        assert kg["entities"][0]["entity_name"] == "s3_object:file.csv"

    def test_chunk_id_is_deterministic(self):
        kg1 = object_to_kg("same/key.txt", {"Size": 100}, "b")
        kg2 = object_to_kg("same/key.txt", {"Size": 100}, "b")
        assert kg1["chunks"][0]["source_id"] == kg2["chunks"][0]["source_id"]

    def test_different_keys_different_chunk_ids(self):
        kg1 = object_to_kg("a.txt", {"Size": 0}, "b")
        kg2 = object_to_kg("b.txt", {"Size": 0}, "b")
        assert kg1["chunks"][0]["source_id"] != kg2["chunks"][0]["source_id"]

    def test_no_relationships(self):
        kg = object_to_kg("file.txt", {"Size": 0}, "b")
        assert kg["relationships"] == []


# -----------------------------------------------------------------------
# Supported extensions
# -----------------------------------------------------------------------


def test_supported_extensions():
    assert ".pdf" in SUPPORTED_EXTENSIONS
    assert ".csv" in SUPPORTED_EXTENSIONS
    assert ".txt" in SUPPORTED_EXTENSIONS
    assert ".docx" in SUPPORTED_EXTENSIONS
    assert ".json" in SUPPORTED_EXTENSIONS
    assert ".md" in SUPPORTED_EXTENSIONS
    assert ".exe" not in SUPPORTED_EXTENSIONS


# -----------------------------------------------------------------------
# Connector properties
# -----------------------------------------------------------------------


def test_connector_type():
    assert S3Connector.connector_type == ConnectorType.S3
