## MODIFIED Requirements

### Requirement: API provides workflow execution control

The system SHALL provide endpoints for starting workflow executions, sending signals, and managing schedules.

#### Scenario: Start workflow execution (manual trigger)

-   **WHEN** client sends `POST /api/v1/temporal/workflows/:id/start` with input variables for a workflow whose Start node has `triggerMode: 'manual'`
-   **THEN** system starts a new workflow execution via Temporal Client and returns the workflowId and runId

#### Scenario: Create schedule for scheduled workflow

-   **WHEN** client sends `POST /api/v1/temporal/workflows/:id/start` with input variables for a workflow whose Start node has `triggerMode: 'scheduled'`
-   **THEN** system creates a Temporal Schedule via `client.schedule.create()` and returns the scheduleId, workflowId, and schedule details

#### Scenario: Send signal to workflow

-   **WHEN** client sends `POST /api/v1/temporal/workflows/:workflowId/signal` with signalName and payload
-   **THEN** system sends the signal to the running workflow and returns success

#### Scenario: Get workflow execution status

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:workflowId/status`
-   **THEN** system returns the current execution status (RUNNING, COMPLETED, FAILED, TIMED_OUT)

## ADDED Requirements

### Requirement: API provides schedule management endpoints

The system SHALL provide REST endpoints for managing Temporal Schedules.

#### Scenario: Get schedule details

-   **WHEN** client sends `GET /api/v1/temporal/schedules/:scheduleId`
-   **THEN** system returns schedule details including status, spec, overlap policy, next trigger time, and recent actions

#### Scenario: Pause schedule

-   **WHEN** client sends `POST /api/v1/temporal/schedules/:scheduleId/pause` with an optional `reason` body
-   **THEN** system pauses the schedule and returns success

#### Scenario: Unpause schedule

-   **WHEN** client sends `POST /api/v1/temporal/schedules/:scheduleId/unpause`
-   **THEN** system resumes the schedule and returns success

#### Scenario: Trigger schedule manually

-   **WHEN** client sends `POST /api/v1/temporal/schedules/:scheduleId/trigger`
-   **THEN** system triggers an immediate workflow execution via the schedule and returns success

#### Scenario: Delete schedule

-   **WHEN** client sends `DELETE /api/v1/temporal/schedules/:scheduleId`
-   **THEN** system deletes the schedule and returns success

#### Scenario: Schedule endpoint returns 404 for unknown schedule

-   **WHEN** client sends a request for a scheduleId that does not exist in Temporal
-   **THEN** system returns 404 Not Found with a descriptive message

#### Scenario: Schedule endpoint rejects unauthorized workspace access

-   **WHEN** client sends a schedule management request for a scheduleId whose associated workflow belongs to a different workspace
-   **THEN** system returns 403 Forbidden or 404 Not Found
