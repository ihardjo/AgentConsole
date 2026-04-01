## MODIFIED Requirements

### Requirement: API provides list executions endpoint

The system SHALL provide a REST endpoint for listing all workflow executions of a given workflow definition.

#### Scenario: List all executions for a flow

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:id/executions`
-   **THEN** system queries Temporal for all workflow executions matching the flow definition
-   **AND** system returns array of executions with workflowId, runId, status, startTime, and closeTime

#### Scenario: List executions filtered by status

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:id/executions?status=RUNNING`
-   **THEN** system returns only executions with the specified status

#### Scenario: List executions for unknown flow returns empty

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:id/executions` for an id with no executions
-   **THEN** system returns `{ executions: [], total: 0 }`

### Requirement: API provides query workflow execution endpoint

The system SHALL provide a REST endpoint for querying running Temporal execution state via Temporal queries.

Note: We use `/executions/:executionId` to clearly distinguish from workflow definitions at `/workflows/:id`.

#### Scenario: Query execution state

-   **WHEN** client sends `GET /api/v1/temporal/executions/:executionId/query/:queryName`
-   **THEN** system queries the Temporal workflow using the handle.query() method
-   **AND** system returns the query result as JSON

#### Scenario: Query built-in getWorkflowState

-   **WHEN** client sends `GET /api/v1/temporal/executions/:executionId/query/getWorkflowState`
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

## ADDED Requirements

### Requirement: API provides get execution status endpoint

The system SHALL provide a REST endpoint for retrieving the status of a specific Temporal workflow execution.

#### Scenario: Get execution status

-   **WHEN** client sends `GET /api/v1/temporal/executions/:executionId/status`
-   **THEN** system queries Temporal for the execution status
-   **AND** system returns workflowId, runId, status, startTime, closeTime, and temporalUrl

#### Scenario: Get status of unknown execution returns error

-   **WHEN** client sends `GET /api/v1/temporal/executions/:executionId/status` for an executionId that does not exist
-   **THEN** system returns 500 Internal Server Error with "workflow not found" message

### Requirement: API provides send signal to execution endpoint

The system SHALL provide a REST endpoint for sending signals to running Temporal workflow executions.

#### Scenario: Send signal to execution

-   **WHEN** client sends `POST /api/v1/temporal/executions/:executionId/signal` with `{ signalName, payload }`
-   **THEN** system sends the signal to the Temporal workflow execution
-   **AND** system returns `{ success: true }`

#### Scenario: Send signal without signalName returns error

-   **WHEN** client sends `POST /api/v1/temporal/executions/:executionId/signal` without signalName
-   **THEN** system returns 400 Bad Request with "Signal name is required" message

#### Scenario: Send signal to unknown execution returns error

-   **WHEN** client sends signal to an executionId that does not exist
-   **THEN** system returns 500 Internal Server Error with "workflow not found" message

## REMOVED Requirements

### Requirement: API provides workflow status endpoint under /workflows path

**Reason**: Moved to `/executions/:executionId/status` for semantic clarity. The old route at `GET /workflows/:workflowId/status` incorrectly suggested it operated on workflow definitions.

**Migration**: Use `GET /api/v1/temporal/executions/:executionId/status` instead.

### Requirement: API provides signal endpoint under /workflows path

**Reason**: Moved to `/executions/:executionId/signal` for semantic clarity. The old route at `POST /workflows/:workflowId/signal` incorrectly suggested it operated on workflow definitions.

**Migration**: Use `POST /api/v1/temporal/executions/:executionId/signal` instead.
