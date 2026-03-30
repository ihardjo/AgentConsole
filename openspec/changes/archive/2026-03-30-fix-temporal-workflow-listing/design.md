## Context

The Temporal workflow list UI (`packages/ui/src/views/temporalflows/index.jsx`) sends paginated requests with `page`, `limit`, and `search` query parameters to `GET /temporal/workflows`. The current controller and service implementation ignore these parameters and return a raw array. The UI expects `{ data: [...], total: N }` but receives a bare array, causing `data?.data` to be `undefined` and the list to always appear empty.

Additionally, the list view reuses shared components (`FlowListTable`, `FlowListMenu`) originally built for chatflows. These components don't account for the Temporal workflow type, causing two issues: (1) clicking a workflow name routes to `/canvas/:id` instead of `/temporalcanvas/:id`, and (2) the action menu shows chatflow-specific options that don't apply to Temporal workflows.

Furthermore, the Reschedule button in `TemporalCanvas.jsx` has two issues:

1. **Stale scheduleId:** When a schedule is created, the server saves the new `scheduleId` to the database (in the Start node's data), but the frontend does not update its local React Flow state with this new `scheduleId`. When the user attempts to reschedule, the `startNodeScheduleId` variable holds a stale or undefined value, causing the delete operation to fail.
2. **Stale schedule configuration:** When the user changes schedule settings (e.g., interval from 2m to 5m) and clicks Reschedule, the server reads the schedule configuration from the database via `getWorkflowById()`, which still has the old values. The workflow must be saved before the schedule is created to ensure the server uses the latest configuration.

The `handleStopSchedule` function correctly updates local state after deleting a schedule, but `handleStartWorkflow` does not follow the same pattern.

The chatflows module already implements the pagination pattern correctly in `packages/server/src/services/chatflows/index.ts` using QueryBuilder with `skip`/`take` and returning `{ data, total }`.

## Goals / Non-Goals

**Goals:**

-   Fix the workflow list so saved Temporal workflows appear in the UI
-   Support pagination and search for the Temporal workflow list endpoint
-   Match the existing chatflows implementation pattern for consistency
-   Fix list view routing to navigate to `/temporalcanvas/:id`
-   Restrict action menu to only Rename and Delete for Temporal workflows
-   Use `temporalApi` for Temporal rename/delete to ensure delete cleans up associated Temporal Schedules
-   Fix reschedule button by synchronizing local React state with server-saved `scheduleId`
-   Auto-save workflow **before** schedule creation to ensure server has latest configuration (interval, overlap policy, etc.)
-   Auto-save workflow **after** schedule creation to persist the new `scheduleId`

**Non-Goals:**

-   No changes to other Temporal endpoints (create, update, start, schedules) beyond the reschedule state sync fix
-   No new shared component abstractions — keep the existing prop-drilling pattern

## Decisions

### 1. Mirror the chatflows service pattern

Use TypeORM QueryBuilder with `skip`/`take` for pagination, `ILIKE` for search, and return `{ data, total }`. This matches the existing `chatflowsService.getAllChatflows` implementation exactly.

**Rationale:** Consistency with the existing codebase. The chatflows implementation is proven and handles the same `ChatFlow` entity. Introducing a different pattern would create maintenance burden.

**Alternative considered:** Simple `.find()` with `skip`/`take` — rejected because it doesn't support text search via `ILIKE`.

### 2. Use `getPageAndLimitParams` utility

Extract pagination params in the controller using the existing `getPageAndLimitParams(req)` utility from `packages/server/src/utils/pagination.ts`.

**Rationale:** Single source of truth for pagination parsing, includes validation for negative values.

### 3. Fix routing via `isTemporalCanvas` prop in FlowListTable

`index.jsx` already passes `isTemporalCanvas={true}` to `FlowListTable`, but the component doesn't destructure it. Fix: destructure the prop and update the `onFlowClick` function to return `/temporalcanvas/${row.id}` when `isTemporalCanvas` is true.

**Rationale:** The prop is already wired up from the caller. Just needs to be consumed.

### 4. Conditional action menu via `isTemporalCanvas` prop in FlowListMenu

Pass `isTemporalCanvas` from `FlowListTable` to `FlowListMenu`. When true, render only Rename and Delete menu items, and use `temporalApi` (not `chatflowsApi`) for both operations.

**Rationale:** Using `temporalApi.deleteTemporalWorkflow` is critical because it triggers schedule cleanup on the server (deletes associated Temporal Schedule before removing the DB record). Using `chatflowsApi.deleteChatflow` would leave orphaned schedules.

**Alternative considered:** Create a separate `TemporalFlowListMenu` component — rejected to avoid duplication. The existing component already handles rename and delete with the same UX pattern.

### 5. Update local state after schedule creation in handleStartWorkflow

After successful schedule creation in `handleStartWorkflow`, update the Start node's `scheduleId` in the local React Flow state using `setNodes()`. This mirrors the pattern used in `handleStopSchedule`, which correctly sets `scheduleId: undefined` after stopping a schedule.

**Rationale:** Consistency with `handleStopSchedule`. Both operations modify the schedule state and should keep local state in sync with the server. Without this update, the `startNodeScheduleId` variable (derived from `startNodeData?.scheduleId`) will be stale during subsequent reschedule attempts.

### 6. Auto-save workflow before and after schedule creation

**Before schedule creation:** Save the current workflow state to the database before calling `startTemporalWorkflow`. This ensures the server reads the latest schedule configuration (interval, overlap policy, catchup window) when creating the Temporal schedule.

**After schedule creation:** Update the local state with the new `scheduleId` and auto-save to persist it.

**Rationale:** The server's `createSchedule` function reads schedule configuration from the database via `getWorkflowById()` and `getStartNodeFromFlowData()`. If the user changes the interval from 2m to 5m but doesn't save, the server will still create a schedule with 2m interval. Auto-saving before schedule creation ensures the server has the latest configuration.

**Implementation:** Use `await` with `temporalApi.updateTemporalWorkflow()` before calling `startTemporalWorkflow()` to ensure the save completes first.

**Alternative considered:** Pass schedule configuration in the request body — rejected because it would require API changes and the existing pattern of reading from the workflow is consistent with how other workflow operations work.

## Risks / Trade-offs

-   **Backward compatibility**: The response format changes from `ChatFlow[]` to `{ data: ChatFlow[], total: number }`. Since the UI already expects the new format and nothing else consumes this endpoint, there is no real risk.
-   **FlowListMenu coupling**: Adding temporal-specific branching to the shared `FlowListMenu` component increases complexity. If more flow types are added in the future, a more general abstraction may be warranted.
-   **Auto-save side effect**: Auto-saving before and after schedule creation may be unexpected to users. However, this ensures the schedule is created with the correct configuration and the `scheduleId` is properly persisted. The UX benefit (reschedule "just works") outweighs the implicit save behavior.
