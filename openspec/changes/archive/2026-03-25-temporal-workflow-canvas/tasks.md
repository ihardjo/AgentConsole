## 1. Infrastructure Setup

-   [x] 1.1 Add `TEMPORAL` to `EnumChatflowType` enum in `packages/server/src/database/entities/ChatFlow.ts`
-   [x] 1.2 Create TypeORM migration for enum update (Not needed - type column is TEXT, not DB enum)
-   [x] 1.3 Add Temporal dependencies to workspace: `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow`, `@temporalio/activity`
-   [x] 1.4 Add environment variable `TEMPORAL_ADDRESS` (default: `localhost:7233`) to server config

## 2. Temporal Worker Package

-   [x] 2.1 Create `packages/temporal-worker/` package structure with package.json and tsconfig.json
-   [x] 2.2 Implement worker entry point (`src/worker.ts`) that connects to Temporal server and polls task queue
-   [x] 2.3 Implement `fetchFlowDefinition` activity to load flow JSON from database
-   [x] 2.4 Implement `callAgentFlow` activity that calls Flowise Prediction API with `streaming: false`
-   [x] 2.5 Implement `httpRequest` activity for external API calls
-   [x] 2.6 Implement `durableWorkflowExecutor` workflow that interprets flow graph and executes nodes
-   [x] 2.7 Add topological sort utility for determining node execution order
-   [x] 2.8 Add template resolution utility for `{{variable}}` placeholder substitution
-   [x] 2.9 Add expression evaluator for Condition node expressions

## 3. Backend API

-   [x] 3.1 Create Temporal client service (`packages/server/src/services/temporal/client.ts`)
-   [x] 3.2 Create Temporal workflow service with CRUD operations
-   [x] 3.3 Create Temporal controller (`packages/server/src/controllers/temporal/index.ts`)
-   [x] 3.4 Add routes for `POST /api/v1/temporal/workflows` (create)
-   [x] 3.5 Add routes for `GET /api/v1/temporal/workflows` (list)
-   [x] 3.6 Add routes for `GET /api/v1/temporal/workflows/:id` (get by ID)
-   [x] 3.7 Add routes for `PUT /api/v1/temporal/workflows/:id` (update)
-   [x] 3.8 Add routes for `DELETE /api/v1/temporal/workflows/:id` (delete)
-   [x] 3.9 Add route for `POST /api/v1/temporal/workflows/:id/start` (start execution)
-   [x] 3.10 Add route for `POST /api/v1/temporal/workflows/:workflowId/signal` (send signal)
-   [x] 3.11 Add route for `GET /api/v1/temporal/workflows/:workflowId/status` (execution status)
-   [x] 3.12 Add route for `GET /api/v1/temporal/agentflows` (list workspace AgentFlows for dropdown)
-   [x] 3.13 Register Temporal routes in main router

## 4. Frontend API Client

-   [x] 4.1 Create `packages/ui/src/api/temporal.js` with API client functions
-   [x] 4.2 Add Redux actions/reducers for Temporal workflows (`packages/ui/src/store/reducers/temporalReducer.js`)

## 5. Temporal Canvas UI

-   [x] 5.1 Create `packages/ui/src/views/temporalflows/` directory structure
-   [x] 5.2 Create `TemporalFlowList.jsx` - list view of Temporal workflows (`index.jsx`)
-   [x] 5.3 Create `TemporalCanvas.jsx` - main ReactFlow canvas (adapted from agentflowsv2/Canvas.jsx)
-   [x] 5.4 Create `TemporalFlowContext.jsx` - context provider for canvas state (Not needed - using Redux instead)
-   [x] 5.5 Create node palette sidebar component (`AddTemporalNodes.jsx`)
-   [x] 5.6 Create canvas toolbar with Save, Run Workflow, and View in Temporal UI buttons

## 6. Temporal Node Components

-   [x] 6.1 Create `StartNode.jsx` with output anchor and input variables config
-   [x] 6.2 Create `AgentFlowCallNode.jsx` with workspace-scoped AgentFlow dropdown and question template
-   [x] 6.3 Create `TimerNode.jsx` with duration input field
-   [x] 6.4 Create `SignalWaitNode.jsx` with signal name and timeout fields
-   [x] 6.5 Create `ConditionNode.jsx` with expression input and True/False output anchors
-   [x] 6.6 Create `HTTPRequestNode.jsx` with URL, method dropdown, and body fields
-   [x] 6.7 Create node configuration dialog component for editing node properties (`TemporalNodeConfigDialog.jsx`)
-   [x] 6.8 Register node types in ReactFlow nodeTypes object (in `TemporalCanvas.jsx`)

## 7. Navigation and Routing

-   [x] 7.1 Add "Durable Workflows" menu item to sidebar navigation (`packages/ui/src/menu-items/dashboard.js`)
-   [x] 7.2 Add routes for `/temporalflows` (list) and `/temporalcanvas/:id` (canvas)
-   [x] 7.3 Add route guards for workspace authentication (RequireAuth with `temporalflows:view` permission)

## 8. Testing and Documentation

-   [x] 8.1 Test worker connects to Temporal server (localhost:7233) and polls tasks
-   [x] 8.2 Test creating and saving a Temporal workflow via UI
-   [x] 8.3 Test running a simple workflow (Start → Timer → AgentFlowCall)
-   [x] 8.4 Test sending a signal to a waiting workflow
-   [x] 8.5 Add README section for Temporal setup and usage (`docs/temporal-workflow-setup.md`)

## 9. Docker Infrastructure

-   [x] 9.1 Create `docker/temporal-worker/Dockerfile` using `node:20-slim` (glibc-based, required for Temporal SDK native bindings)
-   [x] 9.2 Create `docker/temporal-worker/docker-compose.yml` with build configuration
-   [x] 9.3 Create `docker/temporal-worker/.env.example` with environment template
-   [x] 9.4 Create `docker/temporal-worker/README.md` with setup instructions
-   [x] 9.5 Add Temporal environment variables to `docker/docker-compose.yml` (using `host.containers.internal` for Podman)
-   [x] 9.6 Add Temporal environment variables to `docker/worker/docker-compose.yml`
-   [x] 9.7 Update `docker/worker/Dockerfile` to skip UI build for worker-only image
-   [x] 9.8 Create `packages/ui/src/views/temporalflows/index.css` for ReactFlow canvas styling

## 10. API Key Authentication for AgentFlowCall

-   [x] 10.1 Add database dependencies to temporal-worker (`pg`, `typeorm`, `reflect-metadata`)
-   [x] 10.2 Create database connection utility (`packages/temporal-worker/src/database/dataSource.ts`)
-   [x] 10.3 Modify `fetchFlowDefinition` to use direct database query instead of HTTP API
-   [x] 10.4 Add API key dropdown to `TemporalNodeConfigDialog.jsx` for `temporalAgentFlowCall` node type
-   [x] 10.5 Update `TemporalCanvas.jsx` to fetch API keys and pass to dialog
-   [x] 10.6 Update `AgentFlowCallNode.jsx` to indicate API key status (configured vs missing)
-   [x] 10.7 Modify `callAgentFlow` activity to accept `apiKeyId` parameter and lookup API key from database
-   [x] 10.8 Update `durableWorkflow.ts` to pass `apiKeyId` from node data to `callAgentFlow` activity
-   [x] 10.9 Align naming: rename `agentflowId` to `agentFlowId` for consistency across codebase
-   [x] 10.10 Update `docker/temporal-worker/.env.example` - remove `FLOWISE_API_KEY`, document DB is required
-   [x] 10.11 Update `docs/temporal-workflow-setup.md` with API key configuration instructions
