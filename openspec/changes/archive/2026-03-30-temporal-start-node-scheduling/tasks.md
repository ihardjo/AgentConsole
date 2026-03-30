## 1. Server — Schedule Service Functions

-   [x] 1.1 Add `ScheduleConfig` interface to `packages/server/src/services/temporal/index.ts` with fields: `triggerMode`, `scheduleInterval`, `overlapPolicy`, `catchupWindow`
-   [x] 1.2 Add `createSchedule()` function that parses Start node data, validates interval format, calls `client.schedule.create()`, stores `scheduleId` back on Start node data
-   [x] 1.3 Add `getScheduleDetails(scheduleId)` function that calls `client.schedule.getHandle(scheduleId).describe()`
-   [x] 1.4 Add `pauseSchedule(scheduleId, reason)` function
-   [x] 1.5 Add `unpauseSchedule(scheduleId)` function
-   [x] 1.6 Add `triggerSchedule(scheduleId)` function
-   [x] 1.7 Add `deleteSchedule(scheduleId)` function
-   [x] 1.8 Add `parseDurationToMs(interval)` validation helper that accepts `<number><s|m|h|d>` format and rejects invalid inputs
-   [x] 1.9 Modify `deleteWorkflow()` to look up `scheduleId` in Start node data and delete the Temporal Schedule before deleting the workflow record

## 2. Server — Modify Start Workflow to Branch on Trigger Mode

-   [x] 2.1 Modify `startWorkflow()` to read `flowData` JSON, find the first `temporalStart` node, check `triggerMode`
-   [x] 2.2 If `triggerMode === 'scheduled'`, call `createSchedule()` instead of `client.workflow.start()` and return schedule info
-   [x] 2.3 If `triggerMode === 'manual'` or undefined, keep current `client.workflow.start()` behavior

## 3. Server — Schedule API Routes

-   [x] 3.1 Add schedule routes to `packages/server/src/routes/temporal/index.ts`: GET `/schedules/:scheduleId`, POST `/schedules/:scheduleId/pause`, POST `/schedules/:scheduleId/unpause`, POST `/schedules/:scheduleId/trigger`, DELETE `/schedules/:scheduleId`

-   [x] 3.2 Add controller functions in `packages/server/src/controllers/temporal/index.ts` for each schedule endpoint with workspace validation and error handling

## 4. UI — API Client

-   [x] 4.1 Add schedule API functions to `packages/ui/src/api/temporal.js`: `getScheduleDetails`, `pauseSchedule`, `unpauseSchedule`, `triggerSchedule`, `deleteSchedule`

## 5. UI — Start Node Configuration

-   [x] 5.1 Update Start node default data in `AddTemporalNodes.jsx` to include `triggerMode: 'manual'`, `scheduleInterval: ''`, `overlapPolicy: 'SKIP'`, `catchupWindow: ''`
-   [x] 5.2 Update Start node case in `TemporalNodeConfigDialog.jsx` to add trigger mode toggle (manual/scheduled), interval field, overlap policy dropdown, and catchup window field
-   [x] 5.3 Update `StartNode.jsx` to display trigger mode badge — show "Manual" or "Every X" on the node

## 6. UI — Canvas Run Action

-   [x] 6.1 Modify Run Workflow handler in `TemporalCanvas.jsx` to read Start node `triggerMode` and adjust success messaging (show scheduleId + interval for scheduled, workflowId for manual)

## 7. UI — Schedule Management Controls

-   [x] 7.1 Add `scheduleDetails` state + fetch logic to `TemporalCanvas.jsx`: on workflow load, if Start node has `scheduleId`, call `temporalApi.getScheduleDetails(scheduleId)` and store result; expose `scheduleDetails`, `isSchedulePaused`, `hasScheduleId` derived values
-   [x] 7.2 Add schedule action handlers to `TemporalCanvas.jsx`: `handlePauseSchedule`, `handleResumeSchedule`, `handleTriggerSchedule`, `handleStopSchedule` — each calls the corresponding API and refreshes scheduleDetails on success
-   [x] 7.3 Add schedule status chip to toolbar in `TemporalCanvas.jsx`: show "Scheduled" (green) or "Paused" (amber) chip next to TEMPORAL chip when scheduleId exists
-   [x] 7.4 Add schedule action dropdown to toolbar in `TemporalCanvas.jsx`: MUI ButtonGroup or split-button with dropdown options (Pause/Resume, Trigger Now, Stop Schedule), only visible when scheduleId exists
-   [x] 7.5 Modify Run button in `TemporalCanvas.jsx` to show contextual label: "Run" (manual), → "Schedule" (scheduled, no scheduleId) → "Reschedule" (scheduled, has scheduleId)
-   [x] 7.6 Modify `handleStartWorkflow` in `TemporalCanvas.jsx`: when scheduleId already exists, show confirm dialog "Delete existing schedule and create new one?", on confirm call `temporalApi.deleteSchedule(scheduleId)` first, then proceed with normal start flow; after successful schedule creation, re-fetch scheduleDetails
-   [x] 7.7 Update `handleStopSchedule` to clear `scheduleId` from Start node data in React Flow state, reset `scheduleDetails` state, and auto-save the workflow to persist the cleared scheduleId to the database
-   [x] 7.8 Add a warning banner in `TemporalNodeConfigDialog.jsx` Start node case: when `scheduleId` exists and `triggerMode === 'scheduled'`, show "Schedule changes require clicking Reschedule to take effect" warning below the trigger mode toggle
