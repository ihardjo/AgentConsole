## Why

Temporal workflows currently lack the ability to loop back to previous nodes, which is essential for implementing iterative patterns like retries, polling, and refinement workflows. The chatflow system already supports this via a Loop node, and users need the same capability in durable temporal workflows.

Additionally, the Temporal Web UI link in the workflow canvas is broken because the client-side code uses an undefined `window.TEMPORAL_WEB_UI_URL` variable that is never set, and the env vars are not documented in `.env.example` files.

## What Changes

-   Add a new **Loop node** to the temporal workflow canvas that redirects execution back to a specified upstream node
-   Loop node will have configurable max iterations (default: 3) to prevent infinite loops
-   Loop edges will be visually distinguished with a dashed line style (brown color #795548)
-   The configuration dialog will show a dropdown of valid upstream nodes as targets
-   Validation will ensure the selected target node exists and is upstream of the Loop node
-   Context is preserved across loop iterations (accumulated state pattern)
-   **Fix broken Temporal UI link** using `VITE_TEMPORAL_WEB_UI_URL` env var with Docker build-arg support

## Capabilities

### New Capabilities

-   `temporal-loop-node`: Add Loop node type to temporal workflows with max iterations, upstream target selection, dashed edge visualization, and execution engine support for clearing/re-executing nodes in the loop path

### Modified Capabilities

-   `temporal-canvas`: Add Loop node registration, dashed edge rendering for loop edges, validation for loop target selection, and fix Temporal UI link to use `VITE_TEMPORAL_WEB_UI_URL` env var

## Impact

-   **UI Components**:

    -   `packages/ui/src/views/temporalflows/AddTemporalNodes.jsx` - Add Loop node definition
    -   `packages/ui/src/views/temporalflows/nodes/LoopNode.jsx` - New visual component
    -   `packages/ui/src/views/temporalflows/TemporalNodeConfigDialog.jsx` - Loop configuration form
    -   `packages/ui/src/views/temporalflows/TemporalEdge.jsx` - Dashed style support
    -   `packages/ui/src/views/temporalflows/TemporalCanvas.jsx` - Node registration, edge handling, fix Temporal UI link
    -   `packages/ui/src/views/temporalflows/temporalNodeOutputs.js` - Loop output schema

-   **Execution Engine**:

    -   `packages/temporal-worker/src/workflows/durableWorkflow.ts` - Loop execution logic, path clearing
    -   `packages/temporal-worker/src/utils/topologicalSort.ts` - Allow intentional loops (back-edges to loop nodes)

-   **Environment & Docker Configuration**:

    -   `Dockerfile` (root) - Add build ARG for `VITE_TEMPORAL_WEB_UI_URL`
    -   `packages/ui/.env.example` - Add `VITE_TEMPORAL_WEB_UI_URL` for local dev
    -   `docker/.env.example` - Document `VITE_TEMPORAL_WEB_UI_URL` build-arg
    -   `docker/docker-compose-queue-source.yml` - Add build args for source builds

-   **No API changes required** - Loop logic is handled entirely in the workflow execution
