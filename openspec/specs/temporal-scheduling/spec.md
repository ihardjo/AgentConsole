## ADDED Requirements

### Requirement: System creates Temporal Schedule for scheduled workflows

The system SHALL use the Temporal Client SDK `client.schedule.create()` to create a recurring schedule when a workflow with `triggerMode: 'scheduled'` on its Start node is run.

#### Scenario: Create interval-based schedule

-   **WHEN** user runs a workflow whose Start node has `triggerMode: 'scheduled'` and `scheduleInterval: '10m'`
-   **THEN** system creates a Temporal Schedule with `spec.intervals: [{ every: '10m' }]` that starts the `durableWorkflowExecutor` workflow on the configured interval

#### Scenario: Schedule uses configured overlap policy

-   **WHEN** a schedule is created with `overlapPolicy: 'BUFFER_ONE'`
-   **THEN** system sets `policies.overlap` to `BUFFER_ONE` on the Temporal Schedule

#### Scenario: Schedule uses configured catchup window

-   **WHEN** a schedule is created with `catchupWindow: '1h'`
-   **THEN** system sets `policies.catchupWindow` to `'1 hour'` on the Temporal Schedule

#### Scenario: Schedule ID is stored on Start node after creation

-   **WHEN** a Temporal Schedule is successfully created
-   **THEN** system updates the Start node's `data.scheduleId` in the saved flow definition and persists it to the database

#### Scenario: Schedule action passes workflow input

-   **WHEN** a schedule is created with input variables `{ reportType: 'daily' }`
-   **THEN** the schedule's action args include `{ flowId, workspaceId, input: { reportType: 'daily' } }`

### Requirement: System provides schedule lifecycle management

The system SHALL provide operations to list, pause, unpause, trigger, and delete Temporal Schedules.

#### Scenario: Get schedule details for a workflow

-   **WHEN** client requests schedule details for a workflow that has a `scheduleId` on its Start node
-   **THEN** system uses `client.schedule.getHandle(scheduleId).describe()` to return schedule details including status, spec, next trigger time, and recent actions

#### Scenario: Pause a schedule

-   **WHEN** client sends a pause request for a schedule
-   **THEN** system calls `client.schedule.getHandle(scheduleId).pause(reason)` and returns success

#### Scenario: Unpause a schedule

-   **WHEN** client sends an unpause request for a schedule
-   **THEN** system calls `client.schedule.getHandle(scheduleId).unpause()` and returns success

#### Scenario: Trigger a schedule manually

-   **WHEN** client sends a trigger request for a schedule
-   **THEN** system calls `client.schedule.getHandle(scheduleId).trigger()` to execute the workflow immediately

#### Scenario: Delete a schedule

-   **WHEN** client sends a delete request for a schedule
-   **THEN** system calls `client.schedule.getHandle(scheduleId).delete()` and returns success
-   **NOTE** The caller (UI or server) is responsible for clearing `scheduleId` from Start node data if needed

### Requirement: System validates schedule interval format

The system SHALL validate schedule interval strings before creating a Temporal Schedule.

#### Scenario: Valid interval format

-   **WHEN** user provides interval `'10m'`, `'1h'`, `'30s'`, or `'1d'`
-   **THEN** system accepts the interval and creates the schedule

#### Scenario: Invalid interval format

-   **WHEN** user provides interval `'every ten minutes'` or `'abc'`
-   **THEN** system returns a 400 error with a message describing the expected format (`<number><s|m|h|d>`)

### Requirement: System cleans up schedule on workflow deletion

The system SHALL delete the associated Temporal Schedule when a workflow is deleted.

#### Scenario: Workflow with active schedule is deleted

-   **WHEN** user deletes a workflow whose Start node has a `scheduleId`
-   **THEN** system deletes the Temporal Schedule via `client.schedule.getHandle(scheduleId).delete()` before deleting the workflow record
