"""Tests for the FastAPI application (api.py)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from federated_rag.api import create_app


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    """Create a test client with isolated storage."""
    app = create_app(storage_dir=tmp_path)
    return TestClient(app)


@pytest.fixture()
def workspace_payload() -> dict:
    return {
        "name": "Test Workspace",
        "owner_id": "user_owner",
        "org_id": "org_1",
        "description": "A test workspace",
    }


# -----------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------


def test_health(client: TestClient):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


# -----------------------------------------------------------------------
# Workspace CRUD
# -----------------------------------------------------------------------


class TestWorkspaceCRUD:

    def test_create_workspace(self, client: TestClient, workspace_payload: dict):
        resp = client.post("/api/workspaces", json=workspace_payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Test Workspace"
        assert body["owner_id"] == "user_owner"
        assert body["organization_id"] == "org_1"
        assert body["description"] == "A test workspace"
        assert "id" in body

    def test_get_workspace(self, client: TestClient, workspace_payload: dict):
        create_resp = client.post("/api/workspaces", json=workspace_payload)
        ws_id = create_resp.json()["id"]

        resp = client.get(f"/api/workspaces/{ws_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == ws_id
        assert resp.json()["name"] == "Test Workspace"

    def test_get_workspace_not_found(self, client: TestClient):
        resp = client.get("/api/workspaces/nonexistent")
        assert resp.status_code == 404

    def test_list_workspaces(self, client: TestClient, workspace_payload: dict):
        client.post("/api/workspaces", json=workspace_payload)

        resp = client.get("/api/workspaces", params={"user_id": "user_owner"})
        assert resp.status_code == 200
        workspaces = resp.json()
        assert len(workspaces) >= 1
        assert workspaces[0]["owner_id"] == "user_owner"

    def test_list_workspaces_empty_for_other_user(
        self, client: TestClient, workspace_payload: dict,
    ):
        client.post("/api/workspaces", json=workspace_payload)

        resp = client.get("/api/workspaces", params={"user_id": "other_user"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_delete_workspace(self, client: TestClient, workspace_payload: dict):
        create_resp = client.post("/api/workspaces", json=workspace_payload)
        ws_id = create_resp.json()["id"]

        resp = client.delete(f"/api/workspaces/{ws_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

        # Verify it's gone
        resp = client.get(f"/api/workspaces/{ws_id}")
        assert resp.status_code == 404

    def test_delete_workspace_not_found(self, client: TestClient):
        resp = client.delete("/api/workspaces/nonexistent")
        assert resp.status_code == 404


# -----------------------------------------------------------------------
# Membership
# -----------------------------------------------------------------------


class TestMembership:

    def _create_workspace(self, client: TestClient, payload: dict) -> str:
        resp = client.post("/api/workspaces", json=payload)
        return resp.json()["id"]

    def test_get_members_includes_owner(
        self, client: TestClient, workspace_payload: dict,
    ):
        ws_id = self._create_workspace(client, workspace_payload)

        resp = client.get(f"/api/workspaces/{ws_id}/members")
        assert resp.status_code == 200
        members = resp.json()
        assert len(members) == 1
        assert members[0]["user_id"] == "user_owner"
        assert members[0]["role"] == "owner"

    def test_add_member(self, client: TestClient, workspace_payload: dict):
        ws_id = self._create_workspace(client, workspace_payload)

        resp = client.post(
            f"/api/workspaces/{ws_id}/members",
            json={"user_id": "user_viewer", "role": "viewer"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "added"

        # Verify member is listed
        members_resp = client.get(f"/api/workspaces/{ws_id}/members")
        members = members_resp.json()
        assert len(members) == 2
        user_ids = {m["user_id"] for m in members}
        assert "user_viewer" in user_ids

    def test_add_duplicate_member_fails(
        self, client: TestClient, workspace_payload: dict,
    ):
        ws_id = self._create_workspace(client, workspace_payload)

        # Owner is auto-added, so adding again should fail
        resp = client.post(
            f"/api/workspaces/{ws_id}/members",
            json={"user_id": "user_owner", "role": "admin"},
        )
        assert resp.status_code == 400

    def test_remove_member(self, client: TestClient, workspace_payload: dict):
        ws_id = self._create_workspace(client, workspace_payload)

        client.post(
            f"/api/workspaces/{ws_id}/members",
            json={"user_id": "user_editor", "role": "editor"},
        )

        resp = client.delete(f"/api/workspaces/{ws_id}/members/user_editor")
        assert resp.status_code == 200
        assert resp.json()["status"] == "removed"

    def test_remove_nonexistent_member(
        self, client: TestClient, workspace_payload: dict,
    ):
        ws_id = self._create_workspace(client, workspace_payload)

        resp = client.delete(f"/api/workspaces/{ws_id}/members/ghost_user")
        assert resp.status_code == 404


# -----------------------------------------------------------------------
# Data source registration
# -----------------------------------------------------------------------


class TestDataSources:

    def _create_workspace(self, client: TestClient, payload: dict) -> str:
        resp = client.post("/api/workspaces", json=payload)
        return resp.json()["id"]

    def test_register_source(self, client: TestClient, workspace_payload: dict):
        ws_id = self._create_workspace(client, workspace_payload)

        resp = client.post(
            f"/api/workspaces/{ws_id}/sources",
            json={
                "connector_type": "postgresql",
                "config": {"host": "localhost", "port": 5432, "database": "mydb"},
                "display_name": "Production DB",
                "sync_mode": "manual",
                "description": "Main database",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["workspace_id"] == ws_id
        assert body["connector_type"] == "postgresql"
        assert body["display_name"] == "Production DB"
        assert body["status"] == "disconnected"
        assert body["description"] == "Main database"
        assert "id" in body

    def test_register_source_invalid_connector_type(
        self, client: TestClient, workspace_payload: dict,
    ):
        ws_id = self._create_workspace(client, workspace_payload)

        resp = client.post(
            f"/api/workspaces/{ws_id}/sources",
            json={
                "connector_type": "invalid_type",
                "config": {},
                "display_name": "Bad Source",
            },
        )
        assert resp.status_code == 400

    def test_list_sources(self, client: TestClient, workspace_payload: dict):
        ws_id = self._create_workspace(client, workspace_payload)

        client.post(
            f"/api/workspaces/{ws_id}/sources",
            json={
                "connector_type": "postgresql",
                "config": {"host": "localhost"},
                "display_name": "DB 1",
            },
        )
        client.post(
            f"/api/workspaces/{ws_id}/sources",
            json={
                "connector_type": "mongodb",
                "config": {"uri": "mongodb://localhost"},
                "display_name": "Mongo 1",
            },
        )

        resp = client.get(f"/api/workspaces/{ws_id}/sources")
        assert resp.status_code == 200
        sources = resp.json()
        assert len(sources) == 2
        names = {s["display_name"] for s in sources}
        assert names == {"DB 1", "Mongo 1"}

    def test_list_sources_empty(self, client: TestClient, workspace_payload: dict):
        ws_id = self._create_workspace(client, workspace_payload)

        resp = client.get(f"/api/workspaces/{ws_id}/sources")
        assert resp.status_code == 200
        assert resp.json() == []


# -----------------------------------------------------------------------
# Access control
# -----------------------------------------------------------------------


class TestAccessControl:

    def _setup_workspace_with_source(
        self, client: TestClient, payload: dict,
    ) -> tuple[str, str]:
        """Create workspace + register a source, return (ws_id, source_id)."""
        ws_id = client.post("/api/workspaces", json=payload).json()["id"]

        source_resp = client.post(
            f"/api/workspaces/{ws_id}/sources",
            json={
                "connector_type": "postgresql",
                "config": {"host": "localhost"},
                "display_name": "Test DB",
            },
        )
        source_id = source_resp.json()["id"]
        return ws_id, source_id

    def test_get_accessible_sources(
        self, client: TestClient, workspace_payload: dict,
    ):
        ws_id, source_id = self._setup_workspace_with_source(
            client, workspace_payload,
        )

        resp = client.get(
            f"/api/workspaces/{ws_id}/access/user_owner",
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "accessible_source_ids" in body

    def test_grant_access(self, client: TestClient, workspace_payload: dict):
        ws_id, source_id = self._setup_workspace_with_source(
            client, workspace_payload,
        )

        # Add a viewer member first
        client.post(
            f"/api/workspaces/{ws_id}/members",
            json={"user_id": "user_viewer", "role": "viewer"},
        )

        resp = client.post(
            f"/api/workspaces/{ws_id}/sources/{source_id}/access",
            json={
                "admin_id": "user_owner",
                "target_user_id": "user_viewer",
                "level": "full",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "granted"
        assert resp.json()["level"] == "full"

    def test_grant_access_invalid_level(
        self, client: TestClient, workspace_payload: dict,
    ):
        ws_id, source_id = self._setup_workspace_with_source(
            client, workspace_payload,
        )

        resp = client.post(
            f"/api/workspaces/{ws_id}/sources/{source_id}/access",
            json={
                "admin_id": "user_owner",
                "target_user_id": "user_viewer",
                "level": "superadmin",
            },
        )
        assert resp.status_code == 400

    def test_revoke_access(self, client: TestClient, workspace_payload: dict):
        ws_id, source_id = self._setup_workspace_with_source(
            client, workspace_payload,
        )

        # Add member + grant
        client.post(
            f"/api/workspaces/{ws_id}/members",
            json={"user_id": "user_editor", "role": "editor"},
        )
        client.post(
            f"/api/workspaces/{ws_id}/sources/{source_id}/access",
            json={
                "admin_id": "user_owner",
                "target_user_id": "user_editor",
                "level": "full",
            },
        )

        resp = client.delete(
            f"/api/workspaces/{ws_id}/sources/{source_id}/access/user_editor",
            params={"admin_id": "user_owner"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "revoked"

    def test_revoke_access_no_override(
        self, client: TestClient, workspace_payload: dict,
    ):
        ws_id, source_id = self._setup_workspace_with_source(
            client, workspace_payload,
        )

        # Try to revoke without a prior grant
        resp = client.delete(
            f"/api/workspaces/{ws_id}/sources/{source_id}/access/user_nobody",
            params={"admin_id": "user_owner"},
        )
        assert resp.status_code == 403
