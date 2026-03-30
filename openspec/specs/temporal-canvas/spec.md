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

#### Scenario: User runs a manual workflow

-   **WHEN** user clicks Run Workflow button for a workflow whose Start node has `triggerMode: 'manual'`
-   **THEN** system starts the workflow execution immediately and displays a success confirmation with workflow ID

#### Scenario: User schedules a workflow (first time)

-   **WHEN** user clicks the "Schedule" button for a workflow whose Start node has `triggerMode: 'scheduled'` and no `scheduleId`
-   **THEN** system creates a Temporal Schedule and displays a success confirmation with schedule ID and interval

#### Scenario: User reschedules an existing schedule

-   **WHEN** user clicks the "Reschedule" button for a workflow whose Start node has `triggerMode: 'scheduled'` and an existing `scheduleId`
-   **THEN** system shows a confirmation dialog: "This will delete the existing schedule and create a new one. Continue?"
-   **AND** on confirm, system deletes the old schedule via `deleteSchedule` API, then creates a new schedule via `startWorkflow` API
-   **AND** displays a success confirmation with the new schedule ID and interval

#### Scenario: User clicks View in Temporal UI

-   **WHEN** user clicks View in Temporal UI button
-   **THEN** system opens the Temporal Web UI (port 8080) in a new browser tab

### Requirement: Canvas toolbar provides schedule management actions

The system SHALL display schedule management controls in the toolbar when the Start node has an active `scheduleId`.

#### Scenario: Schedule status chip displayed

-   **WHEN** workflow has a Start node with a `scheduleId`
-   **THEN** toolbar shows a status chip next to the TEMPORAL chip: "Scheduled" (green) if the schedule is active, "Paused" (amber) if the schedule is paused

#### Scenario: Schedule details fetched on workflow load

-   **WHEN** a saved workflow is loaded whose Start node has a `scheduleId`
-   **THEN** system fetches schedule details via `getScheduleDetails` API and updates the status chip based on the schedule's paused state

#### Scenario: User pauses an active schedule

-   **WHEN** user clicks "Pause Schedule" from the toolbar dropdown and the schedule is currently active
-   **THEN** system calls `pauseSchedule` API, refreshes schedule details, and updates the status chip to "Paused" (amber)

#### Scenario: User resumes a paused schedule

-   **WHEN** user clicks "Resume Schedule" from the toolbar dropdown and the schedule is currently paused
-   **THEN** system calls `unpauseSchedule` API, refreshes schedule details, and updates the status chip to "Scheduled" (green)

#### Scenario: User triggers schedule manually

-   **WHEN** user clicks "Trigger Now" from the toolbar dropdown
-   **THEN** system calls `triggerSchedule` API and displays a success snackbar

#### Scenario: User stops a schedule

-   **WHEN** user clicks "Stop Schedule" from the toolbar dropdown and confirms
-   **THEN** system calls `deleteSchedule` API, clears the `scheduleId` from the Start node data in React Flow state
-   **AND** auto-saves the workflow to persist the cleared `scheduleId` to the database
-   **AND** removes the schedule status chip and action dropdown from the toolbar
-   **AND** reverts the Run button label to "Schedule"

#### Scenario: Config dialog warns about unsaved schedule changes

-   **WHEN** user opens the Start node config dialog for a node that has an existing `scheduleId` and `triggerMode === 'scheduled'`
-   **THEN** system displays a warning: "Schedule changes require clicking Reschedule to take effect" below the trigger mode toggle
-   **AND** the warning remains visible while the user edits schedule fields

### Requirement: Canvas persists workflow as JSON in database

The system SHALL save the workflow definition (nodes, edges, node configurations) as JSON in the `flowData` column of the `chat_flow` table with `type: 'TEMPORAL'`, including schedule configuration on the Start node.

#### Scenario: Workflow with schedule config is saved

-   **WHEN** user saves a Temporal workflow with a Start node configured as `triggerMode: 'scheduled'`, `scheduleInterval: '1h'`
-   **THEN** system stores the flowData JSON with the full schedule configuration in the Start node's data field

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
