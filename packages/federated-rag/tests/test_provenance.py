from __future__ import annotations

import pytest

from federated_rag.provenance import (
    decode_source_id,
    encode_source_id,
    make_file_path,
    parse_file_path,
    tag_custom_kg,
)


def test_encode_source_id():
    assert encode_source_id("ds_abc123", "chunk_001") == "ds_abc123::chunk_001"


def test_decode_source_id():
    ds_id, chunk_id = decode_source_id("ds_abc123::chunk_001")
    assert ds_id == "ds_abc123"
    assert chunk_id == "chunk_001"


def test_decode_preserves_extra_separators():
    ds_id, chunk_id = decode_source_id("ds_abc::chunk::with::colons")
    assert ds_id == "ds_abc"
    assert chunk_id == "chunk::with::colons"


def test_decode_raises_on_untagged():
    with pytest.raises(ValueError, match="Not a tagged source_id"):
        decode_source_id("plain_id_no_separator")


def test_encode_decode_round_trip():
    original_ds = "ds_xyz789"
    original_chunk = "employees__id=42"
    tagged = encode_source_id(original_ds, original_chunk)
    ds_id, chunk_id = decode_source_id(tagged)
    assert ds_id == original_ds
    assert chunk_id == original_chunk


def test_make_file_path():
    assert make_file_path("postgresql", "ds_abc") == "postgresql://ds_abc"


def test_parse_file_path():
    source_type, ds_id = parse_file_path("postgresql://ds_abc123")
    assert source_type == "postgresql"
    assert ds_id == "ds_abc123"


def test_parse_file_path_raises_on_plain():
    with pytest.raises(ValueError, match="Not a provenance file_path"):
        parse_file_path("just_a_filename.txt")


def test_make_parse_round_trip():
    fp = make_file_path("mongodb", "ds_mongo_001")
    source_type, ds_id = parse_file_path(fp)
    assert source_type == "mongodb"
    assert ds_id == "ds_mongo_001"


def test_tag_custom_kg_tags_all_fields():
    kg = {
        "chunks": [
            {"source_id": "c1", "content": "hello", "file_path": "test.txt"},
            {"source_id": "c2", "content": "world", "file_path": "test.txt"},
        ],
        "entities": [
            {"entity_name": "Alice", "source_id": "c1", "file_path": "test.txt"},
        ],
        "relationships": [
            {
                "src_id": "Alice", "tgt_id": "Bob",
                "source_id": "c1", "file_path": "test.txt",
            },
        ],
    }

    tagged = tag_custom_kg(kg, ds_id="ds_abc", source_type="postgresql")

    assert tagged["chunks"][0]["source_id"] == "ds_abc::c1"
    assert tagged["chunks"][1]["source_id"] == "ds_abc::c2"
    assert tagged["chunks"][0]["file_path"] == "postgresql://ds_abc"
    assert tagged["entities"][0]["source_id"] == "ds_abc::c1"
    assert tagged["entities"][0]["file_path"] == "postgresql://ds_abc"
    assert tagged["relationships"][0]["source_id"] == "ds_abc::c1"
    assert tagged["relationships"][0]["file_path"] == "postgresql://ds_abc"


def test_tag_custom_kg_does_not_mutate_original():
    kg = {
        "chunks": [{"source_id": "c1", "content": "data", "file_path": "f.txt"}],
        "entities": [],
        "relationships": [],
    }
    tag_custom_kg(kg, ds_id="ds_xyz", source_type="csv")
    assert kg["chunks"][0]["source_id"] == "c1"
    assert kg["chunks"][0]["file_path"] == "f.txt"


def test_tag_custom_kg_handles_empty_kg():
    tagged = tag_custom_kg({}, ds_id="ds_empty", source_type="file")
    assert tagged == {}


def test_tag_custom_kg_handles_missing_keys():
    kg = {"chunks": [{"source_id": "c1", "content": "x", "file_path": "y"}]}
    tagged = tag_custom_kg(kg, ds_id="ds_a", source_type="s3")
    assert tagged["chunks"][0]["source_id"] == "ds_a::c1"
    assert "entities" not in tagged
    assert "relationships" not in tagged
