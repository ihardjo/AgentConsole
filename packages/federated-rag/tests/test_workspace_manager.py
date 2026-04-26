from __future__ import annotations

from pathlib import Path

import pytest

from federated_rag.models import ConnectorType
from federated_rag.source_registry import DataSourceRegistry
from federated_rag.workspace_manager import WorkspaceManager, WorkspaceSettings


@pytest.fixture()
def manager(tmp_path: Path) -> WorkspaceManager:
    registry = DataSourceRegistry(
        storage_path=tmp_path / "sources.json",
        key_path=tmp_path / "test.key",
    )
    return WorkspaceManager(
        registry=registry,
        storage_path=tmp_path / "workspaces.json",
    )


def test_create_workspace(manager: WorkspaceManager):
    ws = manager.create_workspace(
        name="Marketing Team",
        owner_id="user_001",
        org_id="org_001",
        description="Marketing knowledge base",
    )
    assert ws.id.startswith("ws_")
    assert ws.name == "Marketing Team"
    assert ws.owner_id == "user_001"


def test_create_workspace_with_custom_settings(manager: WorkspaceManager):
    settings = WorkspaceSettings(llm_model="gpt-4o-mini", chunk_size=800)
    ws = manager.create_workspace(
        name="Custom WS",
        owner_id="user_001",
        org_id="org_001",
        settings=settings,
    )
    assert ws.settings.llm_model == "gpt-4o-mini"
    assert ws.settings.chunk_size == 800
    assert ws.settings.default_retrieval_mode == "mix"  # default


def test_get_workspace(manager: WorkspaceManager):
    ws = manager.create_workspace("Test", "user_001", "org_001")
    fetched = manager.get_workspace(ws.id)
    assert fetched is not None
    assert fetched.name == "Test"


def test_get_workspace_not_found(manager: WorkspaceManager):
    assert manager.get_workspace("ws_nonexistent") is None


def test_owner_auto_added_as_member(manager: WorkspaceManager):
    ws = manager.create_workspace("WS", "user_001", "org_001")
    members = manager.get_members(ws.id)
    assert len(members) == 1
    assert members[0].user_id == "user_001"
    assert members[0].role == "owner"


def test_list_workspaces_by_user(manager: WorkspaceManager):
    manager.create_workspace("WS A", "user_001", "org_001")
    manager.create_workspace("WS B", "user_001", "org_001")
    manager.create_workspace("WS C", "user_002", "org_001")

    ws_list = manager.list_workspaces("user_001")
    assert len(ws_list) == 2
    assert {ws.name for ws in ws_list} == {"WS A", "WS B"}


def test_add_and_remove_member(manager: WorkspaceManager):
    ws = manager.create_workspace("WS", "user_001", "org_001")

    assert manager.add_member("user_002", ws.id, "editor") is True
    assert manager.add_member("user_002", ws.id, "editor") is False  # duplicate

    members = manager.get_members(ws.id)
    assert len(members) == 2

    assert manager.remove_member("user_002", ws.id) is True
    assert len(manager.get_members(ws.id)) == 1


def test_get_user_role(manager: WorkspaceManager):
    ws = manager.create_workspace("WS", "user_001", "org_001")
    manager.add_member("user_002", ws.id, "viewer")

    assert manager.get_user_role("user_001", ws.id) == "owner"
    assert manager.get_user_role("user_002", ws.id) == "viewer"
    assert manager.get_user_role("user_999", ws.id) is None


def test_delete_workspace_removes_members_and_sources(manager: WorkspaceManager):
    ws = manager.create_workspace("WS", "user_001", "org_001")
    manager.add_member("user_002", ws.id, "editor")
    manager.register_data_source(
        ws.id, ConnectorType.POSTGRESQL,
        {"host": "localhost"}, "Test DB",
    )

    assert manager.delete_workspace(ws.id) is True
    assert manager.get_workspace(ws.id) is None
    assert manager.get_members(ws.id) == []
    assert manager.get_workspace_sources(ws.id) == []


def test_register_data_source_to_workspace(manager: WorkspaceManager):
    ws = manager.create_workspace("WS", "user_001", "org_001")
    reg = manager.register_data_source(
        ws.id, ConnectorType.POSTGRESQL,
        {"host": "localhost", "port": 5432, "user": "u", "password": "p", "database": "db"},
        "Production DB",
    )
    assert reg.id.startswith("ds_")
    assert reg.workspace_id == ws.id

    sources = manager.get_workspace_sources(ws.id)
    assert len(sources) == 1


def test_register_data_source_invalid_workspace(manager: WorkspaceManager):
    with pytest.raises(ValueError, match="Workspace not found"):
        manager.register_data_source(
            "ws_nonexistent", ConnectorType.POSTGRESQL,
            {"host": "localhost"}, "DB",
        )


def test_user_sees_workspace_after_added(manager: WorkspaceManager):
    ws = manager.create_workspace("Shared WS", "user_001", "org_001")
    assert len(manager.list_workspaces("user_002")) == 0

    manager.add_member("user_002", ws.id, "viewer")
    assert len(manager.list_workspaces("user_002")) == 1


def test_persistence(tmp_path: Path):
    registry = DataSourceRegistry(
        storage_path=tmp_path / "sources.json",
        key_path=tmp_path / "test.key",
    )
    ws_path = tmp_path / "workspaces.json"

    m1 = WorkspaceManager(registry=registry, storage_path=ws_path)
    ws = m1.create_workspace("Persist", "user_001", "org_001")
    m1.add_member("user_002", ws.id, "editor")

    m2 = WorkspaceManager(registry=registry, storage_path=ws_path)
    assert m2.get_workspace(ws.id).name == "Persist"
    assert len(m2.get_members(ws.id)) == 2
