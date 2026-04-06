## 1. QueueManager — workspace-aware queue creation

- [x] 1.1 Add `getOrCreateWorkspaceQueue(type: 'prediction' | 'upsert', workspaceId: string): BaseQueue` method to `QueueManager` — lazily creates and caches a per-workspace queue instance under key `<type>:<workspaceId>`
- [x] 1.2 Use the naming convention `<QUEUE_NAME>-<type>-<workspaceId>` inside `getOrCreateWorkspaceQueue` — derive the full queue name from the existing `QUEUE_NAME` const and the passed `workspaceId`
- [x] 1.3 Add `setupWorkspaceQueue(workspaceId, options)` method to `QueueManager` — creates and registers **only** the two workspace-scoped queues (prediction + upsert) without touching legacy global queues; called exclusively from the worker in `queue-dedicated-workspace` mode
- [x] 1.4 Create a `QueueEventsProducer` for each new workspace prediction queue (required for abort event propagation)
- [x] 1.5 Dynamically register the new workspace queue with BullBoard when a `serverAdapter` is available (add a `BullMQAdapter`)
- [x] 1.6 Keep existing `getQueue('prediction' | 'upsert')` and `setupAllQueues()` intact for legacy fallback — do not break their signatures

## 2. Server-side job routing (producer changes)

- [x] 2.1 In `packages/server/src/utils/buildChatflow.ts` — when `MODE=queue-dedicated-workspace` and `workspaceId` is present, call `queueManager.getOrCreateWorkspaceQueue('prediction', workspaceId)`; otherwise fall back to `getQueue('prediction')`
- [x] 2.2 In `packages/server/src/services/documentstore/index.ts` — when `MODE=queue-dedicated-workspace` and `workspaceId` is present, call `queueManager.getOrCreateWorkspaceQueue('upsert', workspaceId)`; otherwise fall back to `getQueue('upsert')`
- [x] 2.3 In `packages/server/src/services/nodes/index.ts` — apply the same MODE-guarded `getOrCreateWorkspaceQueue` pattern for the local `workspaceId`

## 3. Worker — single-workspace consumer

- [x] 3.1 In `packages/server/src/commands/worker.ts`, read `WORKER_WORKSPACE_ID` env variable (single workspace ID)
- [x] 3.2 If `MODE=queue-dedicated-workspace` and `WORKER_WORKSPACE_ID` is set: call `queueManager.setupWorkspaceQueue(workspaceId, ...)` — creates only the two workspace-scoped queues; avoids wasteful legacy queue connections
- [x] 3.3 If `MODE=queue` or `WORKER_WORKSPACE_ID` is absent: retain the existing legacy path using `setupAllQueues()` and the global prediction/upsert queues (backward-compatible fallback); log a warning if `MODE=queue-dedicated-workspace` but `WORKER_WORKSPACE_ID` is missing
- [x] 3.4 Attach a `QueueEvents` `abort` listener for the workspace prediction queue
- [x] 3.5 In `stopProcess()`, gracefully close the prediction BullMQ worker, the upsert BullMQ worker, **and** the `QueueEvents` listener (to prevent Redis connection leaks on shutdown)
- [x] 3.6 Emit info-level log: `[Worker] Prediction Worker <workerId> serving workspace <workspaceId>` and equivalent for upsert
- [x] 3.7 Listen for the BullMQ `Worker` `closing` event on the prediction and upsert workers; when fired, log `[Worker] Workspace <workspaceId> queue has been removed — shutting down worker` and call `stopProcess()` so the process exits cleanly when its queue is obliterated by the server

## 4. Configuration

- [x] 4.1 In `packages/server/src/commands/base.ts`: add `WORKER_WORKSPACE_ID` flag alongside `QUEUE_NAME`, `WORKER_CONCURRENCY`, etc.; update the `MODE` flag documentation to list all valid values: `queue | queue-dedicated-workspace | main`
- [x] 4.2 In `packages/server/src/Interface.ts`: add `QUEUE_DEDICATED_WORKSPACE = 'queue-dedicated-workspace'` to the `MODE` enum
- [x] 4.3 Remove any references to `WORKSPACE_IDS` from `base.ts` and all other files (was never implemented; ensure it does not ship)
- [ ] 4.4 Update `docker/worker/README.md`: document `WORKER_WORKSPACE_ID`, the `queue-dedicated-workspace` MODE, the 1-queue-per-worker model, how `QUEUE_NAME` and `WORKER_WORKSPACE_ID` compose to form queue names, and the manual provisioning runbook for new workspaces
- [x] 4.5 In `docker/worker/.env.example`: update `MODE` comment to `#(queue | queue-dedicated-workspace | main)`; add `# WORKER_WORKSPACE_ID=` with a comment: `# Single workspace ID for this worker. Composes with QUEUE_NAME: <QUEUE_NAME>-prediction-<WORKER_WORKSPACE_ID>. Required when MODE=queue-dedicated-workspace`
- [x] 4.6 In `docker/.env.example` and `packages/server/.env.example`: apply the same MODE comment update and `WORKER_WORKSPACE_ID` entry as task 4.5

## 5. Testing

- [ ] 5.1 Unit test `QueueManager.getOrCreateWorkspaceQueue` — verify correct queue name, single instance returned on repeated calls, no registry publish, and fallback for missing `workspaceId`
- [ ] 5.2 Unit test worker startup — assert exactly two BullMQ worker instances created when `MODE=queue-dedicated-workspace` and `WORKER_WORKSPACE_ID` is set; assert legacy two-worker path when `MODE=queue`
- [ ] 5.3 Unit test worker shutdown — assert both prediction and upsert workers **and** the `QueueEvents` listener are all closed gracefully on SIGTERM (no dangling Redis connections)
- [ ] 5.4 Unit test `QueueManager.teardownWorkspaceQueue` — verify: (a) obliterate called on both prediction and upsert queues for the workspace, (b) `QueueEvents` closed for both, (c) both entries removed from the `queues` Map cache, (d) no-op when workspace has no queues registered
- [ ] 5.5 Unit test workspace deletion queue hook — assert `teardownWorkspaceQueue` is called after `commitTransaction` in `WorkspaceManagementService.deleteWorkspace()` when `MODE=queue-dedicated-workspace`; assert it is NOT called when `MODE=queue`
- [ ] 5.6 Unit test worker `closing` event handler — assert worker calls `stopProcess()` and logs the expected message when the BullMQ `Worker` emits `closing` due to queue obliteration

## 6. Workspace queue teardown

- [x] 6.1 Add `teardownWorkspaceQueue(workspaceId: string): Promise<void>` to `QueueManager` — steps: (1) check if prediction and upsert workspace queues exist in cache; if neither exists, return early; (2) for each queue that exists: log active job count as a warning if > 0, call `queue.obliterate({ force: true })`, close `queueEvents`, remove from `queues` Map; (3) remove corresponding BullBoard adapter registrations by calling `serverAdapter.setQueues(remainingAdapters)` with the workspace queues filtered out
- [x] 6.2 In `WorkspaceManagementService.deleteWorkspace()`: after `queryRunner.commitTransaction()`, add the MODE-guarded teardown call — `if (MODE === QUEUE_DEDICATED_WORKSPACE) await QueueManager.getInstance().teardownWorkspaceQueue(id).catch(logger.error)` — wrapped in `.catch()` so a Redis failure never rolls back the successful DB deletion
- [x] 6.3 In `WorkspaceManagementService.deleteWorkspaceById()`: apply the same post-commit teardown hook as 6.2 — note this method does not manage its own transaction (called within an outer `QueryRunner`), so the caller is responsible for ensuring teardown is triggered after the outer `commitTransaction()`; add a JSDoc comment documenting this responsibility
- [x] 6.4 Add `closeWorkspaceQueues(workspaceId)` helper to `QueueManager` (internal, used by `teardownWorkspaceQueue`) — separates the close-connections step from obliterate for testability
- [x] 6.5 Update `docker/worker/README.md` — add a section explaining that when a workspace is deleted in `queue-dedicated-workspace` mode, the corresponding worker process will receive a `closing` event and exit automatically; operators do not need to manually kill the worker container but should confirm the process has exited

## 7. Runtime bug fixes — infrastructure guard extension

_Discovered during end-to-end testing. All guards that were scoped to `MODE.QUEUE` only had to be extended to also cover `MODE.QUEUE_DEDICATED_WORKSPACE`._

- [x] 7.1 **`index.ts` — `queueManager` initialisation**: add `else if (MODE.QUEUE_DEDICATED_WORKSPACE)` branch in `initDatabase()` that calls `QueueManager.getInstance()`, `initBullBoard()`, and creates `RedisEventSubscriber`; without this the server threw `Cannot read properties of undefined (reading 'getOrCreateWorkspaceQueue')` on first request
- [x] 7.2 **`QueueManager.ts` — `initBullBoard()` method**: add `public initBullBoard(serverAdapter: ExpressAdapter): void` to initialise BullBoard in dedicated-workspace mode (in `queue` mode BullBoard is already set up via `setupAllQueues`); extend the BullBoard route guard in `index.ts` to include `QUEUE_DEDICATED_WORKSPACE`
- [x] 7.3 **`QueueManager.ts` — `getWorkspaceQueueEventsProducer()` method**: add `public getWorkspaceQueueEventsProducer(workspaceId: string): QueueEventsProducer` that retrieves the per-workspace producer from `workspaceQueueEventsProducers` map; required by the abort path
- [x] 7.4 **`controllers/internal-predictions/index.ts` — SSE subscribe guard**: extend `if (process.env.MODE === MODE.QUEUE)` to also match `MODE.QUEUE_DEDICATED_WORKSPACE` before calling `redisSubscriber.subscribe(chatId)`; without this no SSE events reached the browser in dedicated-workspace mode
- [x] 7.5 **`controllers/predictions/index.ts` — SSE subscribe guard**: same fix as 7.4 for the external predictions controller
- [x] 7.6 **`services/chat-messages/index.ts` — abort path**: add `QUEUE_DEDICATED_WORKSPACE` branch to `abortChatMessage(chatId, chatflowid, workspaceId?)` that calls `getWorkspaceQueueEventsProducer(workspaceId).publishEvent({ eventName: 'abort', id })`; without this abort fell through to the local `abortControllerPool.abort()` which has no effect when the job is running in a separate worker process
- [x] 7.7 **`controllers/chat-messages/index.ts` — abort controller**: pass `req.user?.activeWorkspaceId` as the third argument to `abortChatMessage` so the service can identify the correct workspace queue events producer
- [x] 7.8 **`utils/upsertVector.ts` — upsert queue routing**: add `QUEUE_DEDICATED_WORKSPACE` branch that calls `getOrCreateWorkspaceQueue('upsert', workspaceId)` (workspaceId is derived from the chatflow's workspace record); without this upsert jobs were never dispatched in dedicated-workspace mode
- [x] 7.9 **`services/agentflowv2-generator/index.ts` — agentflow generation queue routing**: add `QUEUE_DEDICATED_WORKSPACE` branch; generation is not workspace-specific so it routes to the shared `prediction` queue (same queue as `MODE.QUEUE`); without this branch the generator ran inline instead of via the worker
- [x] 7.10 **`CachePool.ts` — Redis-backed caching**: introduce `isQueueMode()` helper (`MODE.QUEUE || MODE.QUEUE_DEDICATED_WORKSPACE`) and apply it to all 11 guards; without this SSO token, LLM, and embedding caches used in-memory maps instead of Redis, causing cache misses across server/worker process boundary
- [x] 7.11 **`UsageCacheManager.ts` — Redis-backed usage tracking**: extend `initialize()` guard to `MODE.QUEUE || MODE.QUEUE_DEDICATED_WORKSPACE`; without this usage counters were not shared across processes
- [x] 7.12 **`utils/rateLimit.ts` — Redis-backed rate limiting and cross-process sync**: extend four guards (constructor Redis init, `addRateLimiter` RedisStore, `updateRateLimiter` cross-process publish, `initializeRateLimiters` QueueEvents listener) to include `MODE.QUEUE_DEDICATED_WORKSPACE`; without this rate limit updates made on the server were not propagated to or enforced by worker processes
