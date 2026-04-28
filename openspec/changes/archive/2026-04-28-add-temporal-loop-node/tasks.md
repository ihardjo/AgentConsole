## Phase 1: UI Components

-   [x] **Task 1.1**: Add Loop node to `AddTemporalNodes.jsx`

    -   Add `temporalLoop` entry to `TEMPORAL_NODES` array
    -   Import `IconRepeat` from `@tabler/icons-react`
    -   Set color to `#795548` (brown)
    -   Default data: `{ loopToNodeId: '', loopToNodeLabel: '', maxIterations: 3 }`

-   [x] **Task 1.2**: Create `LoopNode.jsx` component

    -   Create `packages/ui/src/views/temporalflows/nodes/LoopNode.jsx`
    -   Brown color scheme, IconRepeat icon
    -   Display target label and max iterations
    -   Single input handle (Position.Left), no output handle
    -   Export and add to nodes index

-   [x] **Task 1.3**: Add Loop node output schema

    -   Add `temporalLoop` entry to `temporalNodeOutputs.js`
    -   Fields: iteration, loopedTo, continueLoop, exitReason

-   [x] **Task 1.4**: Add Loop configuration to `TemporalNodeConfigDialog.jsx`

    -   Add case for `temporalLoop`
    -   Label field
    -   Dropdown for target node (use `getUpstreamNodes` helper)
    -   Max iterations number input
    -   Validation for required target

-   [x] **Task 1.5**: Add `getUpstreamNodes` helper function

    -   Create inside `TemporalNodeConfigDialog.jsx` component
    -   BFS to find all nodes upstream of given node
    -   Used by config dialog for dropdown options

-   [x] **Task 1.6**: Register Loop node in `TemporalCanvas.jsx`
    -   Import `LoopNode` component
    -   Add to `nodeTypes` object
    -   Pass nodes/edges to config dialog

## Phase 2: Edge Visualization

-   [x] **Task 2.1**: Update `TemporalEdge.jsx` for dashed style

    -   Check `data?.isLoopEdge` prop
    -   If true: `strokeDasharray="5,5"`, `stroke="#795548"`
    -   Otherwise: default solid style
    -   Added "Loop" label badge on loop edges

-   [x] **Task 2.2**: Update `onConnect` in `TemporalCanvas.jsx`
    -   Detect when connecting to/from Loop node
    -   Set `data.isLoopEdge = true` for loop edges

## Phase 3: Execution Engine

-   [x] **Task 3.1**: Add loop iteration tracking to `durableWorkflow.ts`

    -   Add `loopIterations` Map to `InternalWorkflowState` interface
    -   Initialize inside `durableWorkflowExecutor`
    -   Scoped to workflow execution (Temporal determinism)

-   [x] **Task 3.2**: Add Loop node execution case

    -   Add `case 'temporalLoop':` to `executeNode` function
    -   Increment iteration counter
    -   Check max iterations
    -   Return result with iteration, loopedTo, continueLoop, exitReason

-   [x] **Task 3.3**: Add loop redirection logic

    -   After `executeNode` for Loop nodes, check `continueLoop`
    -   If true: clear executed nodes in path, call `executeWorkflowGraph` for target
    -   If false: return (end this branch)

-   [x] **Task 3.4**: Implement `clearLoopPath` helper

    -   Create `findNodesInPath` function (BFS from target to loop)
    -   Clear each node from `executed` Set
    -   Do NOT clear context (preserve accumulated state)

-   [x] **Task 3.5**: Update `topologicalSort.ts`
    -   Filter out edges TO loop nodes before cycle detection
    -   This allows intentional back-edges without triggering cycle error

## Phase 4: Fix Temporal UI Link (Docker ARG + VITE env)

-   [x] **Task 4.1**: Add build ARG to `Dockerfile` (root)

    -   Add `ARG VITE_TEMPORAL_WEB_UI_URL=http://localhost:8080` before `pnpm build`
    -   Add `ENV VITE_TEMPORAL_WEB_UI_URL=$VITE_TEMPORAL_WEB_UI_URL`

-   [x] **Task 4.2**: Add `VITE_TEMPORAL_WEB_UI_URL` to `packages/ui/.env.example`

    -   Add comment explaining purpose
    -   Default to `http://localhost:8080`

-   [x] **Task 4.3**: Add `VITE_TEMPORAL_WEB_UI_URL` to `docker/.env.example`

    -   Add under Temporal Configuration section
    -   Include note about BUILD-TIME variable and --build-arg usage

-   [x] **Task 4.4**: Add build args to `docker/docker-compose-queue-source.yml`

    -   Add `args` section under flowise service `build`
    -   Include `VITE_TEMPORAL_WEB_UI_URL=${VITE_TEMPORAL_WEB_UI_URL:-http://localhost:8080}`

-   [x] **Task 4.5**: Update `handleOpenTemporalUI` in `TemporalCanvas.jsx`
    -   Replace `window.TEMPORAL_WEB_UI_URL` with `import.meta.env.VITE_TEMPORAL_WEB_UI_URL`
    -   Update default fallback to `http://localhost:8080`

## Phase 5: Validation & Testing

-   [x] **Task 5.1**: Add save-time validation for Loop nodes

    -   Check target node is selected
    -   Check target node exists
    -   (Upstream validation skipped - too complex for MVP, UX already limits to upstream)

-   [ ] **Task 5.2**: Manual testing scenarios
    -   Test: Loop node in drawer
    -   Test: Loop config with upstream dropdown
    -   Test: Dashed edge visualization
    -   Test: Loop execution (2-3 iterations)
    -   Test: Max iterations limit
    -   Test: Context preservation
    -   Test: Temporal UI link with env var
    -   Test: Docker build with --build-arg
