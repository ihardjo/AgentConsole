## Why

The current API routes mix workflow definitions (canvas configs) and workflow executions (Temporal runs) under the same `/workflows` path with inconsistent parameter naming. This creates confusion: `GET /workflows/:workflowId/status` uses `:workflowId` which is actually a Temporal execution ID, not a flow definition UUID; `POST /workflows/:workflowId/signal` sends signals to executions but lives under `/workflows`; and `GET /workflows/:flowId/executions` uses `:flowId` while other definition endpoints use `:id`.

## What Changes

-   **Move execution-related endpoints** from `/workflows` to `/executions` path for semantic clarity
-   **Rename route parameters** for consistency: `:executionId` for Temporal execution IDs, `:id` for workflow definition UUIDs
-   **Rename controller function** `getWorkflowStatus` to `getExecutionStatus` to reflect its actual purpose
-   **Update UI API client** to match new routes and rename `getWorkflowStatus` to `getExecutionStatus`
-   **Update API documentation** to reflect new route structure and parameter naming

### Route Changes

| Current Route                                  | New Route                                       |
| ---------------------------------------------- | ----------------------------------------------- |
| `GET /workflows/:workflowId/status`            | `GET /executions/:executionId/status`           |
| `POST /workflows/:workflowId/signal`           | `POST /executions/:executionId/signal`          |
| `GET /workflows/:flowId/executions`            | `GET /workflows/:id/executions`                 |
| `GET /executions/:workflowId/query/:queryName` | `GET /executions/:executionId/query/:queryName` |

## Capabilities

### New Capabilities

None. This is a refactoring change.

### Modified Capabilities

-   `temporal-api`: Route paths change from `/workflows/:workflowId` to `/executions/:executionId` for execution-related endpoints. Parameter naming standardized to `:id` for definitions and `:executionId` for Temporal executions.

## Impact

**Server Package (`packages/server/src/`)**:

-   `routes/temporal/index.ts`: Update 4 route paths
-   `controllers/temporal/index.ts`: Rename `getWorkflowStatus` to `getExecutionStatus`, update parameter extraction from `req.params.workflowId` to `req.params.executionId`, change `req.params.flowId` to `req.params.id`

**UI Package (`packages/ui/src/`)**:

-   `api/temporal.js`: Update API paths, rename `getWorkflowStatus` to `getExecutionStatus`, update exports

**Documentation**:

-   `docs/temporal-api-reference.md`: Update route documentation, examples, and integration code samples

**No breaking changes for external consumers** since `sendSignal` and `getWorkflowStatus` are not currently used in UI components (verified via grep). The demo app (`loan-origination-demo-main/`) is out of scope.
