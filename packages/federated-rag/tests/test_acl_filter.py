from __future__ import annotations

from federated_rag.acl_filter import (
    build_context_string,
    extract_ds_id,
    filter_query_results,
)


def test_extract_ds_id_tagged():
    assert extract_ds_id("ds_abc::chunk_001") == "ds_abc"


def test_extract_ds_id_untagged():
    assert extract_ds_id("plain_id") is None


def test_extract_ds_id_empty():
    assert extract_ds_id("") is None


def _make_results(chunks=None, entities=None, relationships=None):
    return {
        "status": "success",
        "data": {
            "chunks": chunks or [],
            "entities": entities or [],
            "relationships": relationships or [],
            "references": [],
        },
    }


def test_filter_passes_accessible_chunks():
    results = _make_results(
        chunks=[
            {"source_id": "ds_hr::c1", "content": "salary data"},
            {"source_id": "ds_fin::c2", "content": "revenue data"},
            {"source_id": "ds_hr::c3", "content": "employee list"},
        ],
    )
    filtered = filter_query_results(results, {"ds_hr"})
    assert len(filtered["data"]["chunks"]) == 2
    contents = {c["content"] for c in filtered["data"]["chunks"]}
    assert contents == {"salary data", "employee list"}


def test_filter_passes_accessible_entities():
    results = _make_results(
        entities=[
            {"entity_name": "Alice", "source_id": "ds_hr::c1"},
            {"entity_name": "Revenue", "source_id": "ds_fin::c2"},
        ],
    )
    filtered = filter_query_results(results, {"ds_hr"})
    assert len(filtered["data"]["entities"]) == 1
    assert filtered["data"]["entities"][0]["entity_name"] == "Alice"


def test_filter_passes_accessible_relationships():
    results = _make_results(
        relationships=[
            {"src_id": "A", "tgt_id": "B", "source_id": "ds_hr::c1"},
            {"src_id": "C", "tgt_id": "D", "source_id": "ds_fin::c2"},
        ],
    )
    filtered = filter_query_results(results, {"ds_hr"})
    assert len(filtered["data"]["relationships"]) == 1


def test_filter_allows_untagged_data():
    results = _make_results(
        chunks=[
            {"source_id": "untagged_chunk", "content": "legacy data"},
            {"source_id": "ds_hr::c1", "content": "hr data"},
        ],
    )
    filtered = filter_query_results(results, {"ds_hr"})
    assert len(filtered["data"]["chunks"]) == 2


def test_filter_multiple_accessible_sources():
    results = _make_results(
        chunks=[
            {"source_id": "ds_hr::c1", "content": "hr"},
            {"source_id": "ds_fin::c2", "content": "finance"},
            {"source_id": "ds_ops::c3", "content": "ops"},
        ],
    )
    filtered = filter_query_results(results, {"ds_hr", "ds_fin"})
    assert len(filtered["data"]["chunks"]) == 2
    contents = {c["content"] for c in filtered["data"]["chunks"]}
    assert contents == {"hr", "finance"}


def test_filter_empty_accessible_sources_blocks_tagged():
    results = _make_results(
        chunks=[
            {"source_id": "ds_hr::c1", "content": "blocked"},
        ],
    )
    filtered = filter_query_results(results, set())
    assert len(filtered["data"]["chunks"]) == 0


def test_filter_preserves_non_data_fields():
    results = {
        "status": "success",
        "message": "ok",
        "data": {"chunks": [], "entities": [], "relationships": []},
        "metadata": {"query_mode": "mix"},
    }
    filtered = filter_query_results(results, {"ds_hr"})
    assert filtered["message"] == "ok"
    assert filtered["metadata"]["query_mode"] == "mix"


def test_filter_passes_through_non_success():
    results = {"status": "failure", "message": "error"}
    filtered = filter_query_results(results, {"ds_hr"})
    assert filtered == results


def test_build_context_entities():
    results = _make_results(
        entities=[
            {
                "entity_name": "Alice",
                "entity_type": "Employee",
                "description": "Senior engineer",
                "source_id": "ds_hr::c1",
            },
        ],
    )
    ctx = build_context_string(results)
    assert "Alice" in ctx
    assert "Employee" in ctx
    assert "Senior engineer" in ctx


def test_build_context_relationships():
    results = _make_results(
        relationships=[
            {
                "src_id": "Alice",
                "tgt_id": "Engineering",
                "description": "works in",
                "source_id": "ds_hr::c1",
            },
        ],
    )
    ctx = build_context_string(results)
    assert "Alice -> Engineering" in ctx
    assert "works in" in ctx


def test_build_context_chunks():
    results = _make_results(
        chunks=[
            {"source_id": "ds_hr::c1", "content": "Alice is a senior engineer."},
        ],
    )
    ctx = build_context_string(results)
    assert "Alice is a senior engineer." in ctx


def test_build_context_empty():
    results = _make_results()
    ctx = build_context_string(results)
    assert ctx == ""
