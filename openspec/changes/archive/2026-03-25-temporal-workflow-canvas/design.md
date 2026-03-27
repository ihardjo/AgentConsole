## Context

AgentConsole currently supports interactive AgentFlows via ReactFlow v11.5.6 with a mature canvas implementation (`packages/ui/src/views/agentflowsv2/Canvas.jsx`). The codebase uses:

-   **Frontend**: React 18.2, Material UI v5.15, Redux Toolkit, Vite 5.0
-   **Backend**: Express.js, TypeORM 0.3.6, PostgreSQL
-   **Existing patterns**: `EnumChatflowType` enum, `chat_flow` table for flow storage, axios API client

Temporal server runs on port 7233 (user's environment). The executive summary (`docs/temporal-integration-executive-summary.md`) provides architectural guidance for a "dynamic interpretation" approach where a generic workflow executor reads graph definitions at runtime.

## Goals / Non-Goals

**Goals:**

-   Create a visual ReactFlow canvas for designing Temporal durable workflows
-   Implement 6 POC node types with simple configuration (no advanced retry/timeout settings)
-   Build a Temporal Worker that interprets saved graph definitions
-   Provide REST API for workflow lifecycle (create, start, signal, status)
-   Reuse existing AgentFlow canvas patterns to minimize new code
-   AgentFlowCall node shows workspace-scoped dropdown of available AgentFlows

**Non-Goals:**

-   Embedded execution monitoring (use external Temporal Web UI link instead)
-   Advanced node configuration (retry policies, complex input mapping) - POC uses simple fields
-   Workflow versioning or migration tooling
-   Temporal server deployment (runs as independent service on port 7233)
-   Parallel/Loop/ErrorHandler nodes (MVP phase, not POC)

## Decisions

### 1. Separate Temporal Canvas vs. Extending AgentFlow Canvas

**Decision**: Create separate `temporalflows` views, copying patterns from `agentflowsv2`.

**Rationale**: Temporal workflows have fundamentally different node types and execution semantics. Mixing them in one canvas would create confusion. Separate views allow independent evolution.

**Alternatives considered**:

-   Extend existing canvas with "mode" toggle → Rejected: too much conditional logic, confusing UX

### 2. Dynamic Interpretation vs. Static Code Generation

**Decision**: Use dynamic interpretation—a single `durableWorkflowExecutor` workflow reads graph JSON at runtime.

**Rationale**: Users expect changes to take effect immediately without redeployment. Static generation would require build/deploy cycle on every save.

**Alternatives considered**:

-   Generate TypeScript workflow files at save time → Rejected: requires rebuild, more complex DevOps

### 3. Database Schema Approach

**Decision**: Extend `EnumChatflowType` with `TEMPORAL` value, store workflows in existing `chat_flow` table.

**Rationale**: Reuses existing infrastructure (CRUD, permissions, workspace scoping). The `flowData` JSON column already stores ReactFlow graph structure.

**Alternatives considered**:

-   New `temporal_workflow` table → Rejected: duplicates logic, harder to maintain

### 4. Temporal Worker as Separate Package

**Decision**: Create `packages/temporal-worker/` as a standalone Node.js service.

**Rationale**: Temporal Workers need to run independently, can scale separately, and have different dependencies (@temporalio/\*). Clean separation from the main server.

**Alternatives considered**:

-   Embed worker in main server → Rejected: workers should scale independently, different lifecycle

### 5. AgentFlow Integration via Flowise Prediction API

**Decision**: AgentFlowCall activity calls `POST /api/v1/prediction/{id}` with `streaming: false`.

**Rationale**: Non-streaming mode already exists. Durable workflows are background automation—no one watches the output stream.

**Alternatives considered**:

-   Direct function invocation → Rejected: would require importing AgentFlow internals, tight coupling

### 6. Node Configuration Simplicity

**Decision**: Simple fields only for POC (name, duration, dropdown, URL). No JSON editors or retry policies.

**Rationale**: Faster to build, easier to test. Advanced config can be added in MVP phase.

### 7. Temporal Worker Docker Image (glibc Requirement)

**Decision**: Use a separate Dockerfile with `node:20-slim` (Debian-based) for the Temporal Worker, not the main Alpine-based image.

**Rationale**: The Temporal SDK's native Rust bridge (`@temporalio/core-bridge`) requires glibc symbols (specifically `__register_atfork`) that are not available in Alpine's musl libc. Using `node:20-slim` provides the necessary glibc support.

**Location**: `docker/temporal-worker/Dockerfile`

**Alternatives considered**:

-   Reuse main AgentConsole Alpine image → Rejected: causes `ERR_DLOPEN_FAILED` with `__register_atfork: symbol not found` error
-   Add gcompat layer to Alpine → Rejected: incomplete glibc compatibility, still fails with some symbols

### 8. Container Networking for Podman/Docker

**Decision**: Use `host.containers.internal` as the default hostname for Temporal server and Flowise API connections in containerized deployments.

**Rationale**: When running in Podman/Docker, `localhost` inside a container refers to the container itself. `host.containers.internal` resolves to the host machine, allowing containers to communicate with services on the host.

**Configuration**: Default values in docker-compose files use `host.containers.internal:7233` for Temporal and `host.containers.internal:3000` for Flowise API.

### 9. Per-Node API Key Authentication for AgentFlowCall

**Decision**: Each AgentFlowCallNode requires selecting an API key from the workspace. The API key ID is stored in the node's data, and the worker looks up the actual key from the database at execution time.

**Rationale**:

-   Different AgentFlows may require different API keys (different access levels, billing)
-   Storing API key ID (not the actual key) is more secure
-   Using existing workspace API keys leverages the existing authentication infrastructure
-   Per-node configuration provides maximum flexibility

**Alternatives considered**:

-   Global `FLOWISE_API_KEY` env var → Rejected: doesn't support per-AgentFlow authentication, requires manual configuration
-   Workflow-level API key → Rejected: less flexible, some workflows may call multiple AgentFlows with different keys

### 10. Direct Database Access for fetchFlowDefinition

**Decision**: The `fetchFlowDefinition` activity queries the database directly instead of calling the HTTP API.

**Rationale**:

-   Avoids chicken-and-egg problem: need flow definition to get API key, but API requires authentication
-   Worker already has database credentials configured
-   Internal operation (reading our own data) doesn't need HTTP auth layer
-   More reliable and faster (no network hop to API server)

**Alternatives considered**:

-   Pass API key at workflow start time → Rejected: adds UX complexity, user must remember to select key each run
-   Store workflow-level API key in metadata → Rejected: still need to fetch metadata first, less flexible than per-node

## Risks / Trade-offs

**[Risk] Temporal server unavailability** → Mitigation: Health check endpoint, clear error messages. Worker retries connection.

**[Risk] Large workflow graphs may hit Temporal state limits** → Mitigation: Document limits. For MVP, add Continue-As-New for long loops.

**[Risk] AgentFlow API latency affects workflow execution** → Mitigation: Activity timeouts (10 min default). Already optimized for API calls.

**[Trade-off] Dynamic interpretation adds ~10ms overhead per node** → Acceptable for background automation. Can optimize in MVP if needed.

**[Trade-off] No embedded execution monitoring** → Users must open Temporal Web UI in separate tab. Simplifies POC scope.

## Migration Plan

1. **Database**: Add `TEMPORAL` to enum via TypeORM migration (non-breaking, additive)
2. **Backend**: Deploy new `/api/v1/temporal/*` routes alongside existing routes
3. **Frontend**: Add new navigation item, independent views—no changes to existing AgentFlow
4. **Infrastructure**: Configure `TEMPORAL_ADDRESS` environment variable (default: `localhost:7233`)
5. **Docker**: Build and deploy `docker/temporal-worker/` image separately from main AgentConsole image
6. **Rollback**: Remove navigation item, disable routes—no data migration needed

## Open Questions

1. ~~**Workspace permissions**: Should Temporal workflows inherit the same permission model as AgentFlows?~~ **Resolved**: Yes, uses `RequireAuth` with `temporalflows:view` permission.
2. ~~**API authentication for Worker**: Should Worker use service account or inherit user context?~~ **Resolved**: Worker connects to database directly for flow definitions (no HTTP auth needed). For AgentFlow calls, each AgentFlowCallNode stores an API key ID; the worker looks up the actual key from the `apikey` table and uses it in the Authorization header.
