from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from federated_rag.federated_lightrag import (
    FederatedLightRAG,
    _build_chunk_id,
    _change_event_to_kg,
)
from federated_rag.models import ChangeEvent, ChangeType


@pytest.fixture()
def mock_rag():
    rag = MagicMock()
    rag.ainsert_custom_kg = AsyncMock()
    rag.aquery = AsyncMock(return_value="Generated response")
    rag.aquery_data = AsyncMock(return_value={
        "status": "success",
        "data": {
            "chunks": [],
            "entities": [],
            "relationships": [],
            "references": [],
        },
    })
    return rag


@pytest.fixture()
def federated(mock_rag):
    return FederatedLightRAG(rag=mock_rag)


SAMPLE_KG = {
    "chunks": [
        {"source_id": "c1", "content": "Alice is an engineer", "file_path": "src.txt"},
    ],
    "entities": [
        {
            "entity_name": "Alice",
            "entity_type": "Employee",
            "description": "An engineer",
            "source_id": "c1",
            "file_path": "src.txt",
        },
    ],
    "relationships": [
        {
            "src_id": "Alice",
            "tgt_id": "Engineering",
            "description": "works in",
            "keywords": "department",
            "source_id": "c1",
            "weight": 1.0,
            "file_path": "src.txt",
        },
    ],
}


async def test_insert_with_provenance_tags_and_delegates(federated, mock_rag):
    await federated.insert_with_provenance(
        SAMPLE_KG, source_id="ds_hr01", source_type="postgresql",
    )

    mock_rag.ainsert_custom_kg.assert_awaited_once()
    call_args = mock_rag.ainsert_custom_kg.call_args
    tagged_kg = call_args[0][0]

    assert tagged_kg["chunks"][0]["source_id"] == "ds_hr01::c1"
    assert tagged_kg["chunks"][0]["file_path"] == "postgresql://ds_hr01"
    assert tagged_kg["entities"][0]["source_id"] == "ds_hr01::c1"
    assert tagged_kg["relationships"][0]["source_id"] == "ds_hr01::c1"


async def test_insert_with_provenance_passes_full_doc_id(federated, mock_rag):
    await federated.insert_with_provenance(
        SAMPLE_KG, source_id="ds_01", source_type="csv",
        full_doc_id="doc_abc",
    )
    call_kwargs = mock_rag.ainsert_custom_kg.call_args[1]
    assert call_kwargs["full_doc_id"] == "doc_abc"


async def test_insert_does_not_mutate_original(federated, mock_rag):
    await federated.insert_with_provenance(
        SAMPLE_KG, source_id="ds_x", source_type="file",
    )
    assert SAMPLE_KG["chunks"][0]["source_id"] == "c1"


async def test_query_with_acl_filters_results(federated, mock_rag):
    mock_rag.aquery_data.return_value = {
        "status": "success",
        "data": {
            "chunks": [
                {"source_id": "ds_hr::c1", "content": "hr data"},
                {"source_id": "ds_fin::c2", "content": "finance data"},
            ],
            "entities": [
                {"entity_name": "Alice", "source_id": "ds_hr::c1"},
                {"entity_name": "Revenue", "source_id": "ds_fin::c2"},
            ],
            "relationships": [],
            "references": [],
        },
    }

    result = await federated.query_with_acl(
        "who works here?", accessible_source_ids=["ds_hr"],
    )

    assert len(result["data"]["chunks"]) == 1
    assert result["data"]["chunks"][0]["content"] == "hr data"
    assert len(result["data"]["entities"]) == 1
    assert result["data"]["entities"][0]["entity_name"] == "Alice"


async def test_query_with_acl_passes_param(federated, mock_rag):
    param = MagicMock()
    await federated.query_with_acl(
        "test", accessible_source_ids=["ds_a"], param=param,
    )
    mock_rag.aquery_data.assert_awaited_once_with("test", param)


async def test_query_with_acl_empty_sources_blocks_all(federated, mock_rag):
    mock_rag.aquery_data.return_value = {
        "status": "success",
        "data": {
            "chunks": [{"source_id": "ds_hr::c1", "content": "secret"}],
            "entities": [],
            "relationships": [],
        },
    }
    result = await federated.query_with_acl(
        "query", accessible_source_ids=[],
    )
    assert len(result["data"]["chunks"]) == 0


async def test_incremental_update_processes_inserts(federated, mock_rag):
    now = datetime.now(tz=timezone.utc)
    changes = [
        ChangeEvent(
            change_type=ChangeType.INSERT,
            source_id="ds_hr",
            workspace_id="ws_001",
            resource_name="employees",
            timestamp=now,
            primary_key={"id": 1},
            after={"name": "Alice", "dept": "Engineering"},
        ),
        ChangeEvent(
            change_type=ChangeType.INSERT,
            source_id="ds_hr",
            workspace_id="ws_001",
            resource_name="employees",
            timestamp=now,
            primary_key={"id": 2},
            after={"name": "Bob", "dept": "Sales"},
        ),
    ]
    processed = await federated.incremental_update(
        changes, source_id="ds_hr", source_type="postgresql",
    )
    assert processed == 2
    assert mock_rag.ainsert_custom_kg.await_count == 2


async def test_incremental_update_skips_delete_events(federated, mock_rag):
    now = datetime.now(tz=timezone.utc)
    changes = [
        ChangeEvent(
            change_type=ChangeType.DELETE,
            source_id="ds_hr",
            workspace_id="ws_001",
            resource_name="employees",
            timestamp=now,
            primary_key={"id": 1},
        ),
    ]
    processed = await federated.incremental_update(
        changes, source_id="ds_hr", source_type="postgresql",
    )
    assert processed == 0
    mock_rag.ainsert_custom_kg.assert_not_awaited()


async def test_incremental_update_handles_update_events(federated, mock_rag):
    now = datetime.now(tz=timezone.utc)
    changes = [
        ChangeEvent(
            change_type=ChangeType.UPDATE,
            source_id="ds_hr",
            workspace_id="ws_001",
            resource_name="employees",
            timestamp=now,
            primary_key={"id": 1},
            after={"name": "Alice Updated", "dept": "Engineering"},
        ),
    ]
    processed = await federated.incremental_update(
        changes, source_id="ds_hr", source_type="postgresql",
    )
    assert processed == 1


async def test_delete_source_data_not_implemented(federated):
    with pytest.raises(NotImplementedError, match="Phase 7"):
        await federated.delete_source_data("ds_hr")


def test_build_chunk_id_with_primary_key():
    event = ChangeEvent(
        change_type=ChangeType.INSERT,
        source_id="ds_hr",
        workspace_id="ws_001",
        resource_name="employees",
        timestamp=datetime(2026, 4, 26, tzinfo=timezone.utc),
        primary_key={"id": 42},
        after={"name": "Alice"},
    )
    assert _build_chunk_id(event) == "employees__id=42"


def test_build_chunk_id_composite_pk():
    event = ChangeEvent(
        change_type=ChangeType.INSERT,
        source_id="ds_hr",
        workspace_id="ws_001",
        resource_name="order_items",
        timestamp=datetime(2026, 4, 26, tzinfo=timezone.utc),
        primary_key={"order_id": 10, "item_id": 3},
    )
    chunk_id = _build_chunk_id(event)
    assert "item_id=3" in chunk_id
    assert "order_id=10" in chunk_id


def test_build_chunk_id_no_pk_uses_timestamp():
    event = ChangeEvent(
        change_type=ChangeType.INSERT,
        source_id="ds_hr",
        workspace_id="ws_001",
        resource_name="logs",
        timestamp=datetime(2026, 4, 26, 14, 30, 0, tzinfo=timezone.utc),
    )
    assert _build_chunk_id(event) == "logs__20260426143000"


def test_change_event_to_kg_structure():
    event = ChangeEvent(
        change_type=ChangeType.INSERT,
        source_id="ds_hr",
        workspace_id="ws_001",
        resource_name="employees",
        timestamp=datetime(2026, 4, 26, tzinfo=timezone.utc),
        primary_key={"id": 1},
        after={"name": "Alice", "dept": "Eng"},
    )
    kg = _change_event_to_kg(event, "employees__id=1")

    assert len(kg["chunks"]) == 1
    assert kg["chunks"][0]["source_id"] == "employees__id=1"
    assert "Alice" in kg["chunks"][0]["content"]
    assert "Eng" in kg["chunks"][0]["content"]

    assert len(kg["entities"]) == 1
    assert kg["entities"][0]["entity_type"] == "employees"
    assert "employees_id=1" in kg["entities"][0]["entity_name"]

    assert kg["relationships"] == []
