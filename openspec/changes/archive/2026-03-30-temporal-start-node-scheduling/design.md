## Context

The Temporal Workflow Canvas currently supports on-demand workflow execution via `POST /temporal/workflows/:id/start`. The Start node (`temporalStart`) captures input variables but has no trigger configuration. Temporal's TypeScript Client SDK supports scheduling natively via `client.schedule.create()` with interval or calendar-based specs, overlap policies, and lifecycle management (pause/unpause/trigger/delete).

The scheduling feature is purely a **Temporal Client concern** — no worker changes are needed. The `durableWorkflowExecutor` workflow and all activities remain unchanged.

## Goals / Non-Goals

**Goals:**

-   Allow users to configure a schedule trigger on the Start node (interval-based, e.g., every 10m/1h/1d)
-   When "Run" is clicked on a scheduled workflow, create a Temporal Schedule instead of a one-shot execution
-   Provide schedule lifecycle management (list, pause, unpause, trigger, delete) via API and UI
-   Store schedule ID on the workflow definition so the canvas can display schedule status

**Non-Goals:**

-   Cron/calendar-based scheduling (stretch goal — interval covers most use cases)
-   Schedule backfill
-   Modifying an existing schedule (delete + recreate is acceptable for MVP)
-   Changes to the Temporal worker or workflow executor
-   Schedule execution history UI

## Decisions

### 1. Schedule config lives in the Start node data

**Decision**: Store `triggerMode`, `scheduleInterval`, `overlapPolicy`, and `catchupWindow` in the Start node's `data` field.

**Alternative considered**: Separate "Schedule" dialog on the Run button. Rejected because the start node is the standard "trigger" pattern in visual workflow builders (n8n, Zapier, Power Automate). Embedding it in the node makes the workflow self-documenting.

**Data shape added to Start node `data`**:

```
triggerMode: 'manual' | 'scheduled'    // default: 'manual'
scheduleInterval: string                 // e.g., '10m', '1h', '1d' (only if scheduled)
overlapPolicy: 'SKIP' | 'ALLOW_ALL' | 'BUFFER_ONE' | 'CANCEL_OTHER'  // default: 'SKIP'
catchupWindow: string                    // e.g., '1h', '1d' (optional)
```

### 2. "Run" action reads Start node and branches

**Decision**: When the user clicks "Run", the server reads the first `temporalStart` node from the flow data. If `triggerMode === 'manual'`, it calls `client.workflow.start()` (current behavior). If `triggerMode === 'scheduled'`, it calls `client.schedule.create()`.

**Alternative considered**: Separate "Schedule" button. Rejected to avoid UI clutter — the Run button contextually does the right thing based on the Start node config.

### 3. Schedule ID stored in Start node data after creation

**Decision**: After creating a schedule, store the `scheduleId` back into the Start node's data in the database. This allows the UI to show schedule status without a separate lookup.

**Alternative considered**: Separate `schedules` database table. Rejected for MVP simplicity — Temporal is the source of truth for schedule state. We only need the scheduleId to look it up.

### 4. Schedule management via dedicated REST endpoints

**Decision**: Add `/temporal/schedules/*` endpoints for lifecycle operations (list, pause, unpause, trigger, delete). These operate on Temporal's schedule service, not our database.

### 5. Interval-only scheduling for MVP

**Decision**: Support interval-based scheduling (`every X minutes/hours/days`) only. Cron/calendar specs are a stretch goal.

**Rationale**: Intervals cover the most common use cases (every 10 minutes, every hour, every day). Cron adds UI complexity (expression builder/parsing) for marginal additional value.

### 6. Schedule management controls in the canvas toolbar

**Decision**: When a Start node has a `scheduleId`, the canvas toolbar shows contextual schedule management controls:

-   A **schedule status chip** (green "Scheduled" / amber "Paused") next to the TEMPORAL chip, reflecting live state from Temporal
-   A **schedule action dropdown** next to the Run button with options: Pause/Resume, Trigger Now, Stop Schedule — only visible when scheduleId exists
-   The **Run button label** changes contextually: "Run" (manual) → "Schedule" (scheduled, no scheduleId) → "Reschedule" (scheduled, scheduleId exists)

**Alternative considered**: Controls in the Start node config dialog. Rejected because the dialog is for editing node configuration, not operational lifecycle actions. The toolbar is the established action surface (already has Run, Save).

**Alternative considered**: Controls on the StartNode itself. Rejected because the node is small with a badge already; adding clickable buttons would be cramped.

**Reschedule flow**: When user clicks "Reschedule" and confirms, the frontend calls `temporalApi.deleteSchedule(scheduleId)` first, then proceeds with the normal `startTemporalWorkflow()` flow which creates a new schedule. The server's `createSchedule()` already stores the new `scheduleId` on the Start node.

**Schedule status fetching**: On workflow load, if the Start node has a `scheduleId`, the canvas fetches schedule details via `temporalApi.getScheduleDetails(scheduleId)` and stores the result. After any schedule action (pause/resume/trigger/stop), the details are re-fetched to update the status chip.

## Risks / Trade-offs

**[Schedule config not synced when Start node is edited]** → Mitigation: If a schedule already exists and the user edits the Start node schedule config, delete the old schedule and prompt re-creation on next Run. For MVP, show a warning that editing schedule config requires re-running.

**[Temporal server unavailable at schedule creation time]** → Mitigation: Return clear error from API; schedule is not created until Temporal confirms. No partial state.

**[Orphaned schedules if workflow is deleted]** → Mitigation: On workflow deletion, look up scheduleId in Start node data and delete the Temporal schedule before deleting the workflow record.

**[Interval parsing ambiguity]** → Mitigation: Use a strict format: `<number><unit>` where unit is `s|m|h|d`. Validate on server side.
