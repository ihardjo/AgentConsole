"""FastAPI application exposing the federated RAG platform.

Provides REST endpoints for:
- Workspace management (CRUD, membership)
- Data source registration and connection testing
- Schema extraction and browsing
- Knowledge graph querying with ACL
- Access control management

See: Architecture Plan Section 3.2 and 6 -- BFF/API Gateway.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from federated_rag.access_control import AccessControlService, AccessLevel
from federated_rag.models import ConnectorType, SyncMode
from federated_rag.source_registry import DataSourceRegistry
from federated_rag.workspace_manager import WorkspaceManager

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class CreateWorkspaceRequest(BaseModel):
    name: str
    owner_id: str
    org_id: str
    description: str = ""


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "viewer"


class RegisterSourceRequest(BaseModel):
    connector_type: str
    config: dict[str, Any]
    display_name: str
    sync_mode: str = "manual"
    description: Optional[str] = None


class GrantAccessRequest(BaseModel):
    admin_id: str
    target_user_id: str
    level: str  # full / read / schema_only / denied


class QueryRequest(BaseModel):
    query: str
    user_id: str
    mode: str = "mix"


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    organization_id: str
    description: str


class SourceResponse(BaseModel):
    id: str
    workspace_id: str
    connector_type: str
    display_name: str
    status: str
    description: Optional[str] = None


class MemberResponse(BaseModel):
    user_id: str
    workspace_id: str
    role: str


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app(
    storage_dir: Path | None = None,
) -> FastAPI:
    """Create the FastAPI application with all routes.

    Args:
        storage_dir: Directory for JSON-backed persistence files.
                     Defaults to ~/.flowise/.
    """
    if storage_dir is None:
        storage_dir = Path.home() / ".flowise"

    registry = DataSourceRegistry(
        storage_path=storage_dir / "federated_sources.json",
        key_path=storage_dir / "federated_encryption.key",
    )
    ws_manager = WorkspaceManager(
        registry=registry,
        storage_path=storage_dir / "federated_workspaces.json",
    )
    acl_service = AccessControlService(
        workspace_manager=ws_manager,
        storage_path=storage_dir / "federated_acl.json",
    )

    app = FastAPI(
        title="Federated RAG API",
        description="Enterprise RAG platform with multi-source knowledge graphs",
        version="0.1.0",
    )

    # Store services on app state for access in route handlers
    app.state.ws_manager = ws_manager
    app.state.registry = registry
    app.state.acl_service = acl_service

    _register_routes(app)
    return app


def _register_routes(app: FastAPI) -> None:
    """Register all API routes."""

    # -- Workspace endpoints --

    @app.post("/api/workspaces", response_model=WorkspaceResponse)
    async def create_workspace(req: CreateWorkspaceRequest):
        ws = app.state.ws_manager.create_workspace(
            name=req.name,
            owner_id=req.owner_id,
            org_id=req.org_id,
            description=req.description,
        )
        return WorkspaceResponse(
            id=ws.id, name=ws.name, owner_id=ws.owner_id,
            organization_id=ws.organization_id, description=ws.description,
        )

    @app.get("/api/workspaces/{workspace_id}", response_model=WorkspaceResponse)
    async def get_workspace(workspace_id: str):
        ws = app.state.ws_manager.get_workspace(workspace_id)
        if ws is None:
            raise HTTPException(404, "Workspace not found")
        return WorkspaceResponse(
            id=ws.id, name=ws.name, owner_id=ws.owner_id,
            organization_id=ws.organization_id, description=ws.description,
        )

    @app.get("/api/workspaces", response_model=list[WorkspaceResponse])
    async def list_workspaces(user_id: str):
        workspaces = app.state.ws_manager.list_workspaces(user_id)
        return [
            WorkspaceResponse(
                id=ws.id, name=ws.name, owner_id=ws.owner_id,
                organization_id=ws.organization_id, description=ws.description,
            )
            for ws in workspaces
        ]

    @app.delete("/api/workspaces/{workspace_id}")
    async def delete_workspace(workspace_id: str):
        if not app.state.ws_manager.delete_workspace(workspace_id):
            raise HTTPException(404, "Workspace not found")
        return {"status": "deleted"}

    # -- Membership endpoints --

    @app.get(
        "/api/workspaces/{workspace_id}/members",
        response_model=list[MemberResponse],
    )
    async def get_members(workspace_id: str):
        members = app.state.ws_manager.get_members(workspace_id)
        return [
            MemberResponse(
                user_id=m.user_id, workspace_id=m.workspace_id, role=m.role,
            )
            for m in members
        ]

    @app.post("/api/workspaces/{workspace_id}/members")
    async def add_member(workspace_id: str, req: AddMemberRequest):
        if not app.state.ws_manager.add_member(
            req.user_id, workspace_id, req.role,
        ):
            raise HTTPException(400, "Could not add member (already exists or workspace not found)")
        return {"status": "added"}

    @app.delete("/api/workspaces/{workspace_id}/members/{user_id}")
    async def remove_member(workspace_id: str, user_id: str):
        if not app.state.ws_manager.remove_member(user_id, workspace_id):
            raise HTTPException(404, "Member not found")
        return {"status": "removed"}

    # -- Data source endpoints --

    @app.post(
        "/api/workspaces/{workspace_id}/sources",
        response_model=SourceResponse,
    )
    async def register_source(workspace_id: str, req: RegisterSourceRequest):
        try:
            reg = app.state.ws_manager.register_data_source(
                workspace_id=workspace_id,
                connector_type=ConnectorType(req.connector_type),
                config=req.config,
                display_name=req.display_name,
                sync_mode=SyncMode(req.sync_mode),
                description=req.description,
            )
        except ValueError as e:
            raise HTTPException(400, str(e))
        return SourceResponse(
            id=reg.id, workspace_id=reg.workspace_id,
            connector_type=reg.connector_type.value,
            display_name=reg.display_name, status=reg.status.value,
            description=reg.description,
        )

    @app.get(
        "/api/workspaces/{workspace_id}/sources",
        response_model=list[SourceResponse],
    )
    async def list_sources(workspace_id: str):
        sources = app.state.ws_manager.get_workspace_sources(workspace_id)
        return [
            SourceResponse(
                id=s.id, workspace_id=s.workspace_id,
                connector_type=s.connector_type.value,
                display_name=s.display_name, status=s.status.value,
                description=s.description,
            )
            for s in sources
        ]

    # -- Access control endpoints --

    @app.get("/api/workspaces/{workspace_id}/access/{user_id}")
    async def get_accessible_sources(workspace_id: str, user_id: str):
        sources = app.state.acl_service.get_accessible_sources(
            user_id, workspace_id,
        )
        return {"accessible_source_ids": sources}

    @app.post("/api/workspaces/{workspace_id}/sources/{source_id}/access")
    async def grant_access(
        workspace_id: str, source_id: str, req: GrantAccessRequest,
    ):
        try:
            level = AccessLevel(req.level)
        except ValueError:
            raise HTTPException(400, f"Invalid access level: {req.level}")

        if not app.state.acl_service.grant_source_access(
            req.admin_id, req.target_user_id, source_id, workspace_id, level,
        ):
            raise HTTPException(403, "Insufficient permissions or invalid target")
        return {"status": "granted", "level": level.value}

    @app.delete(
        "/api/workspaces/{workspace_id}/sources/{source_id}/access/{user_id}",
    )
    async def revoke_access(
        workspace_id: str, source_id: str, user_id: str, admin_id: str,
    ):
        if not app.state.acl_service.revoke_source_access(
            admin_id, user_id, source_id, workspace_id,
        ):
            raise HTTPException(403, "Insufficient permissions or no override exists")
        return {"status": "revoked"}

    # -- Health --

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": "0.1.0"}
