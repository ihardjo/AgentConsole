from __future__ import annotations

from pathlib import Path

import pytest

from federated_rag.access_control import (
    AccessControlService,
    AccessLevel,
    default_access_for_role,
    level_sufficient,
)
from federated_rag.models import ConnectorType
from federated_rag.source_registry import DataSourceRegistry
from federated_rag.workspace_manager import WorkspaceManager


# -----------------------------------------------------------------------
# Pure function tests
# -----------------------------------------------------------------------


class TestLevelSufficient:

    def test_full_meets_all(self):
        for lvl in AccessLevel:
            assert level_sufficient(AccessLevel.FULL, lvl) is True

    def test_read_meets_read_and_below(self):
        assert level_sufficient(AccessLevel.READ, AccessLevel.READ) is True
        assert level_sufficient(AccessLevel.READ, AccessLevel.SCHEMA_ONLY) is True
        assert level_sufficient(AccessLevel.READ, AccessLevel.DENIED) is True
        assert level_sufficient(AccessLevel.READ, AccessLevel.FULL) is False

    def test_schema_only_meets_schema_and_denied(self):
        assert level_sufficient(AccessLevel.SCHEMA_ONLY, AccessLevel.SCHEMA_ONLY) is True
        assert level_sufficient(AccessLevel.SCHEMA_ONLY, AccessLevel.DENIED) is True
        assert level_sufficient(AccessLevel.SCHEMA_ONLY, AccessLevel.READ) is False

    def test_denied_meets_nothing_useful(self):
        assert level_sufficient(AccessLevel.DENIED, AccessLevel.DENIED) is True
        assert level_sufficient(AccessLevel.DENIED, AccessLevel.SCHEMA_ONLY) is False


class TestDefaultAccessForRole:

    def test_owner_gets_full(self):
        assert default_access_for_role("owner") == AccessLevel.FULL

    def test_admin_gets_full(self):
        assert default_access_for_role("admin") == AccessLevel.FULL

    def test_editor_gets_read(self):
        assert default_access_for_role("editor") == AccessLevel.READ

    def test_viewer_gets_schema_only(self):
        assert default_access_for_role("viewer") == AccessLevel.SCHEMA_ONLY

    def test_unknown_role_gets_denied(self):
        assert default_access_for_role("stranger") == AccessLevel.DENIED


# -----------------------------------------------------------------------
# Integration tests (with WorkspaceManager)
# -----------------------------------------------------------------------


@pytest.fixture()
def acl(tmp_path: Path):
    registry = DataSourceRegistry(
        storage_path=tmp_path / "sources.json",
        key_path=tmp_path / "test.key",
    )
    ws_mgr = WorkspaceManager(
        registry=registry,
        storage_path=tmp_path / "workspaces.json",
    )
    return AccessControlService(
        workspace_manager=ws_mgr,
        storage_path=tmp_path / "acl.json",
    ), ws_mgr


def _setup_workspace(ws_mgr: WorkspaceManager):
    """Create a workspace with owner, editor, and viewer, plus one data source."""
    ws = ws_mgr.create_workspace("Test WS", "owner_001", "org_001")
    ws_mgr.add_member("editor_001", ws.id, "editor")
    ws_mgr.add_member("viewer_001", ws.id, "viewer")
    ds = ws_mgr.register_data_source(
        ws.id, ConnectorType.POSTGRESQL,
        {"host": "localhost"}, "HR DB",
    )
    return ws, ds


def test_owner_has_full_by_default(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.check_source_access(
        "owner_001", ds.id, ws.id, AccessLevel.FULL,
    ) is True


def test_editor_has_read_by_default(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.check_source_access(
        "editor_001", ds.id, ws.id, AccessLevel.READ,
    ) is True
    assert svc.check_source_access(
        "editor_001", ds.id, ws.id, AccessLevel.FULL,
    ) is False


def test_viewer_has_schema_only_by_default(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.check_source_access(
        "viewer_001", ds.id, ws.id, AccessLevel.SCHEMA_ONLY,
    ) is True
    assert svc.check_source_access(
        "viewer_001", ds.id, ws.id, AccessLevel.READ,
    ) is False


def test_non_member_denied(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.check_source_access(
        "stranger_001", ds.id, ws.id, AccessLevel.DENIED,
    ) is False


def test_get_accessible_sources_for_owner(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    sources = svc.get_accessible_sources("owner_001", ws.id)
    assert ds.id in sources


def test_get_accessible_sources_for_viewer_empty(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    # Viewer default is schema_only, which is below READ
    sources = svc.get_accessible_sources("viewer_001", ws.id)
    assert sources == []


def test_get_schema_visible_sources_for_viewer(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    sources = svc.get_schema_visible_sources("viewer_001", ws.id)
    assert ds.id in sources


def test_grant_elevates_viewer_to_read(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    # Before grant: viewer can't read
    assert svc.get_accessible_sources("viewer_001", ws.id) == []

    # Owner grants read
    assert svc.grant_source_access(
        "owner_001", "viewer_001", ds.id, ws.id, AccessLevel.READ,
    ) is True

    # After grant: viewer can read
    assert ds.id in svc.get_accessible_sources("viewer_001", ws.id)


def test_grant_can_deny_editor(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    # Editor can read by default
    assert ds.id in svc.get_accessible_sources("editor_001", ws.id)

    # Owner explicitly denies
    svc.grant_source_access(
        "owner_001", "editor_001", ds.id, ws.id, AccessLevel.DENIED,
    )

    assert svc.get_accessible_sources("editor_001", ws.id) == []


def test_grant_fails_for_non_admin(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.grant_source_access(
        "editor_001", "viewer_001", ds.id, ws.id, AccessLevel.READ,
    ) is False


def test_grant_fails_for_non_member_target(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.grant_source_access(
        "owner_001", "stranger_001", ds.id, ws.id, AccessLevel.READ,
    ) is False


def test_revoke_restores_default(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    # Grant then revoke
    svc.grant_source_access(
        "owner_001", "viewer_001", ds.id, ws.id, AccessLevel.READ,
    )
    assert ds.id in svc.get_accessible_sources("viewer_001", ws.id)

    svc.revoke_source_access("owner_001", "viewer_001", ds.id, ws.id)

    # Back to schema_only default
    assert svc.get_accessible_sources("viewer_001", ws.id) == []


def test_revoke_fails_for_non_admin(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    svc.grant_source_access(
        "owner_001", "viewer_001", ds.id, ws.id, AccessLevel.READ,
    )
    assert svc.revoke_source_access(
        "editor_001", "viewer_001", ds.id, ws.id,
    ) is False


def test_revoke_returns_false_when_no_override(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.revoke_source_access(
        "owner_001", "viewer_001", ds.id, ws.id,
    ) is False


def test_get_effective_level(acl):
    svc, ws_mgr = acl
    ws, ds = _setup_workspace(ws_mgr)

    assert svc.get_effective_level("owner_001", ds.id, ws.id) == AccessLevel.FULL
    assert svc.get_effective_level("editor_001", ds.id, ws.id) == AccessLevel.READ
    assert svc.get_effective_level("viewer_001", ds.id, ws.id) == AccessLevel.SCHEMA_ONLY
    assert svc.get_effective_level("stranger_001", ds.id, ws.id) is None


def test_persistence(tmp_path: Path):
    registry = DataSourceRegistry(
        storage_path=tmp_path / "sources.json",
        key_path=tmp_path / "test.key",
    )
    ws_mgr = WorkspaceManager(
        registry=registry,
        storage_path=tmp_path / "workspaces.json",
    )
    acl_path = tmp_path / "acl.json"

    ws = ws_mgr.create_workspace("Persist WS", "owner_001", "org_001")
    ws_mgr.add_member("viewer_001", ws.id, "viewer")
    ds = ws_mgr.register_data_source(
        ws.id, ConnectorType.POSTGRESQL,
        {"host": "localhost"}, "DB",
    )

    svc1 = AccessControlService(workspace_manager=ws_mgr, storage_path=acl_path)
    svc1.grant_source_access(
        "owner_001", "viewer_001", ds.id, ws.id, AccessLevel.FULL,
    )

    svc2 = AccessControlService(workspace_manager=ws_mgr, storage_path=acl_path)
    assert svc2.get_effective_level("viewer_001", ds.id, ws.id) == AccessLevel.FULL


def test_multiple_sources_mixed_access(acl):
    svc, ws_mgr = acl
    ws = ws_mgr.create_workspace("Multi", "owner_001", "org_001")
    ws_mgr.add_member("viewer_001", ws.id, "viewer")

    ds_hr = ws_mgr.register_data_source(
        ws.id, ConnectorType.POSTGRESQL, {"host": "h"}, "HR DB",
    )
    ds_fin = ws_mgr.register_data_source(
        ws.id, ConnectorType.POSTGRESQL, {"host": "h"}, "Finance DB",
    )

    # Grant viewer READ on HR only
    svc.grant_source_access(
        "owner_001", "viewer_001", ds_hr.id, ws.id, AccessLevel.READ,
    )

    accessible = svc.get_accessible_sources("viewer_001", ws.id)
    assert ds_hr.id in accessible
    assert ds_fin.id not in accessible

    # Schema visible includes both
    schema_visible = svc.get_schema_visible_sources("viewer_001", ws.id)
    assert ds_hr.id in schema_visible
    assert ds_fin.id in schema_visible
