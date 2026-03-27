## ADDED Requirements

### Requirement: API provides CRUD operations for Temporal workflows

The system SHALL provide REST endpoints for creating, reading, updating, and deleting Temporal workflow definitions.

#### Scenario: Create workflow

-   **WHEN** client sends `POST /api/v1/temporal/workflows` with name and flowData
-   **THEN** system creates a new workflow record with `type: 'TEMPORAL'` and returns the workflow ID

#### Scenario: Get workflow by ID

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:id`
-   **THEN** system returns the workflow definition including flowData

#### Scenario: Update workflow

-   **WHEN** client sends `PUT /api/v1/temporal/workflows/:id` with updated flowData
-   **THEN** system updates the workflow record and returns success

#### Scenario: Delete workflow

-   **WHEN** client sends `DELETE /api/v1/temporal/workflows/:id`
-   **THEN** system deletes the workflow record and returns success

#### Scenario: List workflows

-   **WHEN** client sends `GET /api/v1/temporal/workflows`
-   **THEN** system returns all Temporal workflows in the current workspace

### Requirement: API provides workflow execution control

The system SHALL provide endpoints for starting workflow executions and sending signals.

#### Scenario: Start workflow execution

-   **WHEN** client sends `POST /api/v1/temporal/workflows/:id/start` with input variables
-   **THEN** system starts a new workflow execution via Temporal Client and returns the workflowId and runId

#### Scenario: Send signal to workflow

-   **WHEN** client sends `POST /api/v1/temporal/workflows/:workflowId/signal` with signalName and payload
-   **THEN** system sends the signal to the running workflow and returns success

#### Scenario: Get workflow execution status

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:workflowId/status`
-   **THEN** system returns the current execution status (RUNNING, COMPLETED, FAILED, TIMED_OUT)

### Requirement: API enforces workspace scoping

The system SHALL ensure all Temporal workflow operations are scoped to the user's active workspace.

#### Scenario: User can only access own workspace workflows

-   **WHEN** user requests a workflow from a different workspace
-   **THEN** system returns 404 Not Found

#### Scenario: List returns only workspace workflows

-   **WHEN** user lists Temporal workflows
-   **THEN** system returns only workflows belonging to the user's active workspace

### Requirement: API provides AgentFlow listing for dropdown

The system SHALL provide an endpoint to list AgentFlows in the current workspace for the AgentFlowCall node dropdown.

#### Scenario: List workspace AgentFlows

-   **WHEN** client sends `GET /api/v1/temporal/agentflows`
-   **THEN** system returns AgentFlows in the current workspace with id, name, and description

### Requirement: API integrates with Temporal Client

The system SHALL use the Temporal TypeScript Client SDK to communicate with the Temporal server.

#### Scenario: Temporal Client connection

-   **WHEN** the server starts
-   **THEN** system initializes a Temporal Client connection to the configured server address (default: localhost:7233)

#### Scenario: Handle Temporal server unavailable

-   **WHEN** the Temporal server is unavailable
-   **THEN** system returns a 503 Service Unavailable error with a descriptive message
