## MODIFIED Requirements

### Requirement: API provides list executions endpoint

The system SHALL provide a REST endpoint for listing all workflow executions of a given workflow definition.

#### Scenario: List all executions for a flow

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:flowId/executions`
-   **THEN** system queries Temporal for all workflow executions matching the flow definition
-   **AND** system returns array of executions with workflowId, runId, status, startTime, and closeTime

#### Scenario: List executions filtered by status

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:flowId/executions?status=RUNNING`
-   **THEN** system returns only executions with the specified status

#### Scenario: List executions for unknown flow returns empty

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:flowId/executions` for a flowId with no executions
-   **THEN** system returns `{ executions: [], total: 0 }`

### Requirement: API provides query workflow execution endpoint

The system SHALL provide a REST endpoint for querying running Temporal execution state via Temporal queries.

Note: We use `/executions/:workflowId` (not `/workflows/:workflowId`) to distinguish:

-   `/temporal/workflows/:id` = saved workflow **definition** (ChatFlow entity in DB)
-   `/temporal/executions/:workflowId` = running Temporal **execution** (runtime instance)

#### Scenario: Query execution state

-   **WHEN** client sends `GET /api/v1/temporal/executions/:workflowId/query/:queryName`
-   **THEN** system queries the Temporal workflow using the handle.query() method
-   **AND** system returns the query result as JSON

#### Scenario: Query built-in getWorkflowState

-   **WHEN** client sends `GET /api/v1/temporal/executions/:workflowId/query/getWorkflowState`
-   **THEN** system returns the workflow's current state including status, currentNodeId, pendingTasks, and sanitized context

#### Scenario: Query unknown execution returns 404

-   **WHEN** client queries an execution that does not exist
-   **THEN** system returns 404 Not Found with descriptive error message

#### Scenario: Query unregistered handler returns 400

-   **WHEN** client queries with a query name that is not registered in the workflow
-   **THEN** system returns 400 Bad Request with "Query handler not registered" message

#### Scenario: Query error returns 500

-   **WHEN** Temporal client encounters an error during query
-   **THEN** system returns 500 Internal Server Error with error details
