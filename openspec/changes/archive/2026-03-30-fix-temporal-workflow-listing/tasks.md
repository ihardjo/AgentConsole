## 1. Server — Controller

-   [x] 1.1 Update `getAllWorkflows` controller in `packages/server/src/controllers/temporal/index.ts` to extract `page`, `limit` via `getPageAndLimitParams(req)` and `search` from `req.query`, then pass all params to the service call

## 2. Server — Service

-   [x] 2.1 Update `getAllWorkflows` service in `packages/server/src/services/temporal/index.ts` to accept `page`, `limit`, and `search` parameters
-   [x] 2.2 Replace `.find()` with QueryBuilder, add `skip`/`take` for pagination, `ILIKE` for name search, and return `{ data, total }` when paginated or flat array when not
-   [x] 2.3 Update the return type from `Promise<ChatFlow[]>` to `Promise<ChatFlow[] | { data: ChatFlow[]; total: number }>`

## 3. Verification (Server)

-   [x] 3.1 Run `npx tsc --noEmit` to verify server compiles

## 4. UI — List View Routing

-   [x] 4.1 Update `FlowListTable` to destructure `isTemporalCanvas` prop and return `/temporalcanvas/${row.id}` in `onFlowClick` when true

## 5. UI — List View Action Menu

-   [x] 5.1 Add `isTemporalCanvas` prop to `FlowListMenu`, conditionally show only Rename and Delete menu items when true
-   [x] 5.2 Update `FlowListMenu` to import and use `temporalApi` for rename and delete when `isTemporalCanvas` is true
-   [x] 5.3 Pass `isTemporalCanvas` from `FlowListTable` to `FlowListMenu`

## 6. UI — Reschedule Button Fix

-   [x] 6.1 In `handleStartWorkflow` in `TemporalCanvas.jsx`, after successful schedule creation, update the Start node's `scheduleId` in local React state using `setNodes()`
-   [x] 6.2 Add auto-save logic after schedule creation (similar to `handleStopSchedule` pattern) to persist the new `scheduleId` to the database
-   [x] 6.3 Add auto-save logic **before** schedule creation to ensure server has latest schedule configuration (interval, overlap policy, etc.)
-   [x] 6.4 Update warning message in `TemporalNodeConfigDialog.jsx` to clarify that changes are applied automatically on reschedule

## 7. Verification (UI)

-   [x] 7.1 Run `npx vite build` to verify UI compiles
