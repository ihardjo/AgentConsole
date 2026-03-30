## MODIFIED Requirements

### Requirement: Canvas toolbar provides workflow actions

The system SHALL display a toolbar with actions: Save, Run Workflow, and View in Temporal UI (external link). The Run Workflow action SHALL read the Start node's trigger mode and create either a one-shot execution or a schedule.

#### Scenario: Navigate to Temporal canvas from list view

-   **WHEN** user clicks a Temporal workflow name in the list view
-   **THEN** system navigates to `/temporalcanvas/:id` (not `/canvas/:id`)

#### Scenario: Action menu shows only Rename and Delete for Temporal workflows

-   **WHEN** user opens the action menu for a Temporal workflow in list view
-   **THEN** system shows only Rename and Delete options (not Duplicate, Export, Starter Prompts, Chat Feedback, Allowed Domains, Speech To Text, or Update Category)

#### Scenario: Rename uses temporal API

-   **WHEN** user renames a Temporal workflow via the list view action menu
-   **THEN** system calls `temporalApi.updateTemporalWorkflow` to persist the rename

#### Scenario: Delete uses temporal API with schedule cleanup

-   **WHEN** user deletes a Temporal workflow via the list view action menu
-   **THEN** system calls `temporalApi.deleteTemporalWorkflow` which cleans up associated Temporal Schedules before deleting the workflow record

### Requirement: Schedule creation syncs local state and saves workflow

The system SHALL save the workflow before creating a schedule (to ensure server has latest configuration) and update the local React Flow state with the new `scheduleId` after successful schedule creation.

#### Scenario: Workflow auto-saved before schedule creation

-   **GIVEN** user has a Temporal workflow with unsaved changes to schedule settings
-   **WHEN** user clicks Schedule or Reschedule
-   **THEN** system saves the current workflow state to the database first
-   **AND** system then creates the schedule with the saved configuration

#### Scenario: Local state updated after schedule creation

-   **GIVEN** user has a saved Temporal workflow with scheduled trigger mode
-   **WHEN** user clicks Schedule and the schedule is created successfully
-   **THEN** system updates the Start node's `scheduleId` in local React Flow state with the value returned from the server
-   **AND** system auto-saves the workflow to persist the `scheduleId`

#### Scenario: Reschedule works after changing interval

-   **GIVEN** user has a Temporal workflow with an active schedule (e.g., 2m interval)
-   **WHEN** user changes the interval (e.g., to 5m) and clicks Reschedule
-   **THEN** system saves the workflow with the new 5m interval
-   **AND** system deletes the existing schedule
-   **AND** system creates a new schedule with the 5m interval
-   **AND** system updates local state with the new `scheduleId`
-   **AND** system auto-saves the workflow to persist the new `scheduleId`

#### Scenario: Reschedule works without page refresh

-   **GIVEN** user just created a schedule (without refreshing the page)
-   **WHEN** user modifies schedule settings and clicks Reschedule
-   **THEN** system successfully deletes the old schedule and creates a new one with the updated settings
