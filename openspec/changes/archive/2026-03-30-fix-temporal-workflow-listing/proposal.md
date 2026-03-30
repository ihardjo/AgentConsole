## Why

Created and saved Temporal workflows do not appear in the workflow list UI. The `getAllWorkflows` service returns a raw array, but the UI expects a paginated response `{ data: [...], total: N }`. This means `data?.data` resolves to `undefined` and the list always shows empty.

Additionally, when clicking a workflow name in list view, the user is routed to `/canvas/:id` instead of `/temporalcanvas/:id`. The action menu also shows chatflow-specific options (Duplicate, Export, Starter Prompts, Chat Feedback, etc.) that don't apply to Temporal workflows — only Rename and Delete are relevant.

Finally, the Reschedule button in the Temporal canvas has two issues:

1. After schedule creation, the server saves the new `scheduleId` to the database but the frontend does not update its local React state, causing stale state issues.
2. When changing schedule settings (e.g., interval from 2m to 5m) and clicking Reschedule, the new settings are not applied because the server reads the schedule configuration from the database, which still has the old values. The workflow must be saved before the schedule is created.

## What Changes

-   Update the `getAllWorkflows` controller to extract `page`, `limit`, and `search` query parameters using the existing `getPageAndLimitParams` utility
-   Update the `getAllWorkflows` service to use QueryBuilder with pagination (`skip`/`take`), optional search filtering by name, and return `{ data, total }` format
-   The service response format changes from `ChatFlow[]` to `{ data: ChatFlow[], total: number }`
-   Fix `FlowListTable` to route to `/temporalcanvas/:id` when `isTemporalCanvas` is true
-   Restrict `FlowListMenu` actions to only Rename and Delete for Temporal workflows
-   Use `temporalApi` for rename and delete in the Temporal flow menu (ensures delete cleans up associated Temporal Schedules)
-   Fix `handleStartWorkflow` in `TemporalCanvas.jsx` to update local React state with the new `scheduleId` after schedule creation
-   Add auto-save **before** schedule/reschedule operations to ensure the server has the latest schedule configuration (interval, overlap policy, etc.)
-   Add auto-save **after** schedule/reschedule operations to persist the new `scheduleId` to the database
-   Update warning message in `TemporalNodeConfigDialog.jsx` to clarify that changes are applied automatically on reschedule

## Capabilities

### New Capabilities

(None)

### Modified Capabilities

-   `temporal-api`: The list workflows endpoint now supports pagination and search, and returns a paginated response format
-   `temporal-canvas`: Workflow list correctly routes to Temporal canvas; action menu shows only relevant options (Rename, Delete) with temporal-specific API calls; reschedule operation auto-saves workflow before creating schedule to ensure latest configuration is used, and syncs local state afterward

## Impact

-   **Server controller**: `packages/server/src/controllers/temporal/index.ts` — `getAllWorkflows` function
-   **Server service**: `packages/server/src/services/temporal/index.ts` — `getAllWorkflows` function
-   **API contract**: Response format for `GET /temporal/workflows` changes from array to `{ data, total }` — but the UI already expects this format, so no UI changes needed for pagination
-   **UI table**: `packages/ui/src/ui-component/table/FlowListTable.jsx` — routing fix
-   **UI menu**: `packages/ui/src/ui-component/button/FlowListMenu.jsx` — conditional action menu with temporal API usage
-   **UI canvas**: `packages/ui/src/views/temporalflows/TemporalCanvas.jsx` — `handleStartWorkflow` function to auto-save before schedule creation and sync scheduleId state afterward
-   **UI dialog**: `packages/ui/src/views/temporalflows/TemporalNodeConfigDialog.jsx` — updated warning message
-   **Dependencies**: Uses existing `getPageAndLimitParams` utility from `packages/server/src/utils/pagination.ts`
