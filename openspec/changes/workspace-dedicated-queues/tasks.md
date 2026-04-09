## 1. Database — `dedicatedQueue` column

- [x] 1.1 Add `dedicatedQueue BOOLEAN NOT NULL DEFAULT FALSE` column to the `workspace` table via TypeORM migration files in `packages/server/src/database/custom-migrations/` (postgres, mysql, sqlite)
- [x] 1.2 Add `@Column({ default: false }) dedicatedQueue: boolean` field to the `Workspace` entity (`packages/server/src/custom-rbac/entities/workspace.entity.ts`)
- [x] 1.3 Ensure migrations are idempotent — postgres uses `ADD COLUMN IF NOT EXISTS`; mysql checks `table.findColumnByName()`; sqlite uses `ensureColumnExists()`; all three registered in their respective `index.ts` migration arrays

## 2. Backend API — workspace CRUD

- [x] 2.1 In `WorkspaceManagementService.createWorkspace()`: `dedicatedQueue` is accepted as part of `Partial<Workspace>` and persisted via `saveWorkspace()` (default `false` when omitted)
- [x] 2.2 In `WorkspaceManagementService.updateWorkspace()`: `dedicatedQueue` is mergeable via `queryRunner.manager.merge()`; when toggled, a `logger.warn` is emitted noting the change applies to new jobs only and in-flight jobs continue on the previous queue
- [x] 2.3 In `WorkspaceManagementService.deleteWorkspace()`: `workspace.dedicatedQueue` is read before `commitTransaction()`; after commit, if `MODE=queue && workspace.dedicatedQueue && id`, `QueueManager.teardownWorkspaceQueue(id)` is called with `.catch(logger.warn)` — DB delete is never rolled back on Redis failure
- [x] 2.4 In `WorkspaceManagementService.deleteWorkspaceById()`: no auto-teardown (runs inside caller's outer transaction); JSDoc documents that the caller is responsible for triggering `teardownWorkspaceQueue` post-commit
- [x] 2.5 `dedicatedQueue` is returned in workspace API responses as part of the `Workspace` entity (entity shape is the response DTO)

## 3. QueueManager — workspace-aware queue creation

- [x] 3.1 `getOrCreateWorkspaceQueue(type, workspaceId, options?)` lazily creates and caches per-workspace queue under key `<QUEUE_NAME>:<workspaceId>:<type>`
- [x] 3.2 Queue name convention: `<QUEUE_NAME>-<workspaceId>-prediction` / `<QUEUE_NAME>-<workspaceId>-upsertion`
- [x] 3.3 `setupWorkspaceQueue(workspaceId, options)` delegates to `getOrCreateWorkspaceQueue` twice and returns `{ predictionQueue, upsertQueue }`
- [x] 3.4 `QueueEventsProducer` created for each new workspace prediction queue; stored in `workspaceQueueEventsProducers` map
- [x] 3.5 New workspace queues incrementally registered with BullBoard via `bullBoardApi.addQueue()` (not full-map rebuild)
- [x] 3.6 `getQueue()` and `setupAllQueues()` retained unchanged for shared-queue path
- [x] 3.7 `teardownWorkspaceQueue(workspaceId)`: warns on active jobs, obliterates both queues, closes `QueueEvents`, deletes from caches, calls `bullBoardApi.replaceQueues()` to deregister from BullBoard
- [x] 3.8 `getWorkspaceQueueEventsProducer(workspaceId)` throws if producer not found (no silent no-op)

## 4. Server initialisation

- [x] 4.1 `index.ts` `initDatabase()`: single `MODE=queue` block initialises `QueueManager`, `createBullBoard` (via `setupAllQueues(serverAdapter)`), and `RedisEventSubscriber`; no separate `else if` branch
- [x] 4.2 BullBoard route guard in `index.ts`: `MODE=queue && ENABLE_BULLMQ_DASHBOARD === 'true' && !identityManager.isCloud()` — single `MODE` condition, no dual-mode check

## 5. Server-side job routing (producer changes)

- [x] 5.1 `packages/server/src/queue/queueUtils.ts` (new file): `getWorkspaceQueue(type, workspaceOrId, queueManager, dataSource?)` as the single routing abstraction; `isDedicatedQueue(workspaceId, dataSource)` with 30s TTL cache; `invalidateDedicatedQueueCache(workspaceId)`
- [x] 5.2 `buildChatflow.ts`: `getWorkspaceQueue('prediction', workspace, appServer.queueManager)` — entity path (zero DB)
- [x] 5.3 `services/documentstore/index.ts`: all 5 upsert dispatch sites use `getWorkspaceQueue('upsert', workspaceId, appServer.queueManager, appServer.AppDataSource)` — string path with TTL cache
- [x] 5.4 `services/nodes/index.ts`: `executeCustomFunction` uses `workspaceId ? getWorkspaceQueue(...) : appServer.queueManager.getQueue('prediction')` — conditional guard prevents empty-string lookup when `workspaceId` is undefined _(fixed during production review)_
- [x] 5.5 `utils/upsertVector.ts`: `getWorkspaceQueue('upsert', workspace, appServer.queueManager)` — entity path (zero DB)
- [x] 5.6 `services/agentflowv2-generator/index.ts`: uses `appServer.queueManager.getQueue('prediction')` directly — agentflow is not workspace-specific
- [x] 5.7 `services/chat-messages/index.ts`: `abortChatMessage()` checks `isDedicatedQueue(workspaceId, appServer.AppDataSource)` and routes to `getWorkspaceQueueEventsProducer(workspaceId)` or `getPredictionQueueEventsProducer()` accordingly

## 6. Dead code removal — `QUEUE_DEDICATED_WORKSPACE` artefacts

_All artefacts from the earlier `queue-dedicated-workspace` implementation have been removed._

- [x] 6.1 **`Interface.ts`** — `QUEUE_DEDICATED_WORKSPACE` deleted; `MODE` enum contains only `QUEUE = 'queue'` and `MAIN = 'main'`
- [x] 6.2 **`commands/base.ts`** — `MODE` flag doc updated to `queue | main`; `WORKER_WORKSPACE_ID` flag retained with updated description
- [x] 6.3 **`index.ts`** — All `QUEUE_DEDICATED_WORKSPACE` branches removed; single `MODE.QUEUE` block
- [x] 6.4 **`CachePool.ts`** — `isQueueMode()` helper deleted; all sites inlined to `process.env.MODE === MODE.QUEUE`
- [x] 6.5 **`UsageCacheManager.ts`** — `initialize()` guard simplified to `MODE.QUEUE` only
- [x] 6.6 **`utils/rateLimit.ts`** — All four guards simplified to `MODE.QUEUE` only
- [x] 6.7 **`controllers/internal-predictions/index.ts`** — `redisSubscriber.subscribe` guard simplified to `MODE.QUEUE`
- [x] 6.8 **`controllers/predictions/index.ts`** — Same as 6.7
- [x] 6.9 **`utils/buildChatflow.ts`** — `MODE.QUEUE_DEDICATED_WORKSPACE` branch removed; replaced by §5.2
- [x] 6.10 **`services/documentstore/index.ts`** — All 5 `MODE.QUEUE_DEDICATED_WORKSPACE` branches removed; replaced by §5.3
- [x] 6.11 **`services/nodes/index.ts`** — `MODE.QUEUE_DEDICATED_WORKSPACE` branch removed; replaced by §5.4
- [x] 6.12 **`utils/upsertVector.ts`** — `MODE.QUEUE_DEDICATED_WORKSPACE` branch removed; replaced by §5.5
- [x] 6.13 **`services/agentflowv2-generator/index.ts`** — `MODE.QUEUE_DEDICATED_WORKSPACE` branch removed; §5.6
- [x] 6.14 **`services/chat-messages/index.ts`** — `MODE.QUEUE_DEDICATED_WORKSPACE` abort branch removed; replaced by §5.7
- [x] 6.15 **`custom-rbac/services/workspace-management/index.ts`** — Teardown guard is `MODE.QUEUE && workspace.dedicatedQueue && id`
- [x] 6.16 **Verification** — `grep -r "QUEUE_DEDICATED_WORKSPACE\|queue-dedicated-workspace" packages/server/src` returns zero matches ✓

## 7. Worker — dedicated vs. shared path within `MODE=queue`

- [x] 7.1 `commands/worker.ts`: dedicated path when `MODE=queue && WORKER_WORKSPACE_ID` is set (calls `setupWorkspaceQueue`); shared path when `WORKER_WORKSPACE_ID` is absent (calls `setupAllQueues`); `isDedicatedMode` and `workspaceId` are `private readonly` class fields
- [x] 7.2 `QueueEvents` `abort` listener attached for the workspace prediction queue in dedicated path
- [x] 7.3 `stopProcess()` closes prediction worker, upsert worker, and `QueueEvents` listener; uses class fields (no re-derivation)
- [x] 7.4 Info-level log emitted per worker: `[Worker] Prediction Worker <workerId> serving workspace <workspaceId>`
- [x] 7.5 `predictionWorker.on('closing')` and `upsertionWorker.on('closing')` both registered; log and call `stopProcess()`

## 8. Frontend — workspace form toggle

- [x] 8.1 "Enable dedicated worker queue" `Switch` toggle added to workspace create form (`AddEditWorkspaceDialog.jsx`)
- [x] 8.2 Same toggle present on workspace edit form; state initialised from `dialogProps.data.dedicatedQueue ?? false`
- [x] 8.3 `dedicatedQueue` state wired into both `addNewWorkspace` and `saveWorkspace` API payloads
- [x] 8.4 `index.jsx` workspace table gains a **"Worker Queue" column** (positioned between Users and Last Updated) — rows with `dedicatedQueue=true` render `<Chip label='Dedicated' size='small' color='primary' variant='outlined' />`; rows with `dedicatedQueue=false` render `<Typography variant='body2' color='text.secondary'>Shared</Typography>`; both skeleton loading rows gain a matching sixth `<StyledTableCell>` to preserve column alignment; the previous inline `<Chip label='Dedicated Queue' />` inside the Name cell is removed
- [x] 8.5 `Tooltip` wraps the `Switch` with: _"Route all jobs for this workspace to a dedicated BullMQ queue. Requires MODE=queue and a worker started with WORKER_WORKSPACE_ID set to this workspace ID."_

## 9. Configuration

- [x] 9.1 `packages/server/.env.example`: `MODE` comment updated to `# MODE=queue #(queue | main)`; `WORKER_WORKSPACE_ID` comment updated with queue-name composition format and `dedicatedQueue=true` requirement
- [x] 9.2 `docker/worker/.env.example`: same `MODE` comment update; `WORKER_WORKSPACE_ID` description updated
- [x] 9.3 `docker/worker/README.md`: rewritten — documents UI toggle, `MODE=queue` + `WORKER_WORKSPACE_ID` worker setup, 1-worker-per-workspace model, queue name composition, and provisioning runbook

## 10. Testing

- [x] 10.1 Unit test `QueueManager.getOrCreateWorkspaceQueue` — verify correct queue name, single instance returned on repeated calls, BullBoard registration
- [x] 10.2 Unit test `getWorkspaceQueue` helper — assert returns `getOrCreateWorkspaceQueue` when `dedicatedQueue=true`, returns `getQueue` when `dedicatedQueue=false`; assert throws when `dataSource` absent on string path
- [x] 10.3 Unit test worker startup — assert dedicated path (two workspace-scoped workers) when `WORKER_WORKSPACE_ID` is set; assert shared path when absent
- [x] 10.4 Unit test worker shutdown — assert both workers and `QueueEvents` listener closed on SIGTERM / `closing` event
- [x] 10.5 Unit test `QueueManager.teardownWorkspaceQueue` — verify obliterate, close, cache removal, BullBoard deregistration; no-op when workspace has no queues
- [x] 10.6 Unit test `deleteWorkspace` teardown hook — assert `teardownWorkspaceQueue` called when `MODE=queue && dedicatedQueue=true`; assert not called when `dedicatedQueue=false`
- [x] 10.7 Unit test `abortChatMessage` — assert workspace-specific producer used when `dedicatedQueue=true`; assert shared producer used when `dedicatedQueue=false`

## 11. Performance optimisations

- [x] 11.1 `queueUtils.ts`: `isDedicatedQueue(workspaceId, dataSource)` — module-level `Map<string, { value: boolean; expiresAt: number }>` with 30s TTL; `invalidateDedicatedQueueCache(workspaceId)` for explicit invalidation
- [x] 11.2 `queueUtils.ts`: `getWorkspaceQueue(type, workspaceOrId, queueManager, dataSource?)` — accepts full `Workspace` entity (zero DB) or `workspaceId` string (TTL cache); throws explicit error when `dataSource` absent on string path (no silent fallback)
- [x] 11.3 `WorkspaceManagementService.updateWorkspace()`: calls `invalidateDedicatedQueueCache(updateWorkspace.id)` after `commitTransaction()` — immediate propagation, no 30s wait
- [x] 11.4 Entity path used at `buildChatflow.ts` and `upsertVector.ts` (entity already in scope); string path used at `documentstore/index.ts`, `nodes/index.ts`, and `chat-messages/index.ts`
- [x] 11.5 `QueueManager` direct imports confined to `worker.ts`, `index.ts`, `workspace-management/index.ts` (teardown only), and `queueUtils.ts`; no routing-purpose imports in controllers or services
- [x] 11.6 `// TODO: shared IORedis connection pool` comment placed in `QueueManager.getOrCreateWorkspaceQueue()` referencing design.md Decision 10
