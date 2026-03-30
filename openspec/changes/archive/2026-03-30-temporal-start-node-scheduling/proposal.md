## Why

Workflows are currently triggered only on-demand via the "Run" button. Many real-world use cases (periodic reports, recurring data sync, scheduled alerts) require workflows to run automatically on a schedule. Temporal natively supports scheduling via `client.schedule.create()`, but the canvas has no way to configure it. Embedding the schedule configuration in the Start node follows the established visual workflow builder pattern where the trigger/entry point defines both "what" (input variables) and "when" (trigger mode).

## What Changes

-   Extend the Start node with a **trigger mode** field: `manual` (default, current behavior) or `scheduled`
-   When `scheduled`, add schedule configuration fields: interval spec, overlap policy, and optional catchup window
-   Add server-side schedule CRUD functions using Temporal's `client.schedule` API
-   Add REST endpoints for schedule management (create, list, pause, unpause, trigger, delete)
-   Modify the canvas "Run" action to read the Start node trigger mode and either start immediately or create a schedule
-   Add schedule management actions to the canvas toolbar (Pause/Resume, Trigger Now, Stop) that appear contextually when a scheduleId exists on the Start node
-   Modify the Run button to show "Schedule" (first time) or "Reschedule" (schedule exists) with automatic delete+recreate on confirmation
-   Show schedule status chip (Active/Paused) next to the TEMPORAL chip in the toolbar when a schedule exists
-   Fetch schedule details on workflow load when scheduleId exists to display current status

## Capabilities

### New Capabilities

-   `temporal-scheduling`: Schedule configuration on the Start node, server-side schedule management via Temporal ScheduleClient, and UI for schedule lifecycle (create, pause, unpause, trigger, delete)

### Modified Capabilities

-   `temporal-nodes`: Start node gains trigger mode and schedule configuration fields
-   `temporal-api`: New schedule management endpoints alongside existing workflow execution endpoints
-   `temporal-canvas`: Run action reads Start node trigger mode; toolbar provides schedule lifecycle controls (pause/resume, trigger, stop, reschedule); schedule status chip displayed contextually

## Impact

-   **UI**: Start node config dialog gains trigger mode toggle + schedule fields; canvas toolbar gains schedule management actions (pause/resume, trigger now, stop) and status chip when schedule exists; Run button label changes contextually (Run → Schedule → Reschedule)
-   **Server**: New schedule service functions in `services/temporal/index.ts`; new routes and controllers
-   **Worker**: No changes — scheduling is purely a Temporal Client feature
-   **API**: New endpoints under `/api/v1/temporal/schedules/*`
-   **Dependencies**: No new packages — uses existing `@temporalio/client` Schedule support
