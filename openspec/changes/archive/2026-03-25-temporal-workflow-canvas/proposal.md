## Why

AgentConsole needs to support durable, long-running workflows that can survive server restarts, handle human approvals, and orchestrate existing AgentFlows as building blocks. The current AgentFlow canvas is optimized for interactive, real-time streaming chat—it cannot handle workflows that run for hours/days, require external signals, or need fault-tolerant execution. Temporal provides this durability layer, and we need a visual ReactFlow canvas to let users design these workflows without writing code.

## What Changes

-   Add a new "Durable Workflows" section in the UI with a dedicated ReactFlow canvas for designing Temporal workflows
-   Implement 6 POC node types: Start, AgentFlowCall (with per-node API key selection), Timer, SignalWait, Condition, HTTPRequest
-   Create a Temporal Worker package that executes workflow definitions by interpreting the visual graph
-   Add backend API endpoints for workflow CRUD, starting workflows, and sending signals
-   Extend the database schema to support `type: 'TEMPORAL'` flows
-   Integrate with Temporal server running on port 7233
-   Create Docker configuration for Temporal Worker in `docker/temporal-worker/` with dedicated Dockerfile
-   Add Temporal environment variables to main docker-compose files (`docker/docker-compose.yml`, `docker/worker/docker-compose.yml`)

## Capabilities

### New Capabilities

-   `temporal-canvas`: ReactFlow-based visual designer for creating Temporal durable workflows with drag-and-drop nodes, edge connections, toolbar actions, and save/load functionality
-   `temporal-nodes`: Six POC node types (Start, AgentFlowCall, Timer, SignalWait, Condition, HTTPRequest) with simple configuration dialogs—AgentFlowCall includes workspace-scoped AgentFlow dropdown and required API key selection for authentication
-   `temporal-worker`: Background service that polls Temporal server, interprets workflow graph definitions, and executes activities (AgentFlow API calls, HTTP requests). Connects directly to database for flow definitions; uses per-node API keys for AgentFlow authentication. Deployed as separate Docker container using `node:20-slim` (glibc-based) due to Temporal SDK native module requirements.
-   `temporal-api`: REST endpoints for workflow management (create, update, delete, start, signal, status) bridging frontend canvas to Temporal server
-   `temporal-docker`: Docker infrastructure for deploying Temporal Worker with proper glibc support

### Modified Capabilities

_(None - this is a new feature that doesn't modify existing AgentFlow behavior)_

## Impact

-   **Frontend**: New views under `packages/ui/src/views/temporalflows/` with canvas, node components, configuration dialogs, and `index.css` for ReactFlow wrapper styles
-   **Backend**: New controller/service/routes under `packages/server/src/` for Temporal operations
-   **New Package**: `packages/temporal-worker/` containing worker entry point, workflow executor, activities, and database connection utilities for direct DB access
-   **Database**: Add `TEMPORAL` to `EnumChatflowType` enum, reuse existing `chat_flow` table for storage. Worker queries `chat_flow` and `apikey` tables directly.
-   **Docker**:
    -   New `docker/temporal-worker/` folder with Dockerfile (node:20-slim), docker-compose.yml, .env.example, and README
    -   Temporal environment variables added to `docker/docker-compose.yml` and `docker/worker/docker-compose.yml`
    -   Worker image uses Debian-based Node.js due to Temporal SDK glibc requirement
-   **Infrastructure**: Requires Temporal server on port 7233, Temporal Web UI on port 8080. Worker requires glibc-based Docker image due to Temporal SDK native Rust bridge (`@temporalio/core-bridge`) incompatibility with Alpine's musl libc.
-   **Dependencies**: New packages `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow`, `@temporalio/activity`. Temporal Worker also requires `pg`, `typeorm`, `reflect-metadata` for direct database access.
-   **Navigation**: Add "Durable Workflows" menu item with BETA chip, linking to external Temporal Web UI for execution monitoring
-   **Networking**: For Podman/Docker deployments, containers use `host.containers.internal` to communicate with Temporal server on host
