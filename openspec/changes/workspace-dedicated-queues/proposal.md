## Why

Currently, all workspaces share a single global `prediction` queue and a single global `upsert` queue, meaning one noisy or high-traffic workspace can starve others. As the platform grows to serve multiple tenants, fair isolation of compute resources per workspace becomes critical.

## What Changes

- **No new `MODE` value** — `MODE=queue` is the single queue mode. The previously designed `queue-dedicated-workspace` MODE is eliminated in favour of a per-workspace database flag.
- A new boolean column **`dedicatedQueue`** (default `false`) is added to the `Workspace` table. When `true` for a given workspace and `MODE=queue` is active, all jobs for that workspace are routed to a workspace-scoped BullMQ queue rather than the shared global queue.
- Operators can toggle **"Enable dedicated worker queue"** when creating or editing a workspace. Workspaces with the toggle off continue to use the shared global queue transparently.
- Each dedicated worker process is still configured via `WORKER_WORKSPACE_ID`; the worker path is unchanged.
- Workers that serve the shared queue continue to use `MODE=queue` with no `WORKER_WORKSPACE_ID`.
- The BullBoard dashboard enumerates all registered queues (shared + per-workspace dedicated).
- `WORKSPACE_IDS` env variable remains removed.

## Capabilities

### New Capabilities

- `workspace-queue-routing`: When `MODE=queue` and a workspace has `dedicatedQueue=true`, the server routes jobs to `<QUEUE_NAME>-<workspaceId>-prediction` / `<QUEUE_NAME>-<workspaceId>-upsertion`. All other workspaces continue using the shared queue with no change.
- `workspace-worker-assignment`: Each dedicated worker process is assigned to exactly one workspace via `WORKER_WORKSPACE_ID` and is started manually or by an external orchestrator.
- `workspace-queue-teardown`: When a workspace with `dedicatedQueue=true` is deleted and `MODE=queue`, its dedicated queues are obliterated from Redis and removed from BullBoard.
- `workspace-dedicated-queue-toggle`: A new "Enable dedicated worker queue" toggle on the workspace create/edit form persists `dedicatedQueue` to the database and is readable via the workspace API. The workspace table gains a **"Worker Queue" column** (between Users and Last Updated) showing a `Dedicated` chip when `dedicatedQueue=true` and muted `Shared` text when `false`; the previous inline "Dedicated Queue" chip in the Name column is removed.

### Modified Capabilities

- `workspace-queue-routing` routing condition: previously `MODE=queue-dedicated-workspace && workspaceId`; now `MODE=queue && workspace.dedicatedQueue === true && workspaceId`.
- `workspace-queue-teardown` guard: previously `MODE=queue-dedicated-workspace`; now `MODE=queue && workspace.dedicatedQueue === true`.

## Impact

### Backend
- **`packages/server/src/Interface.ts`** — Remove `QUEUE_DEDICATED_WORKSPACE` from the `MODE` enum. `MODE` retains only `QUEUE = 'queue'` and `MAIN = 'main'`.
- **`packages/server/src/commands/base.ts`** — Remove `queue-dedicated-workspace` from `MODE` flag documentation; update to `queue | main`. `WORKER_WORKSPACE_ID` flag remains.
- **`packages/server/src/index.ts`** — Remove the `else if (QUEUE_DEDICATED_WORKSPACE)` branch; collapse into the `MODE.QUEUE` branch. `QueueManager`, `BullBoard`, and `RedisEventSubscriber` are all initialised inside the single `MODE.QUEUE` block.
- **`packages/server/src/queue/QueueManager.ts`** — All `QUEUE_DEDICATED_WORKSPACE` guard branches removed; routing condition changes from `MODE === QUEUE_DEDICATED_WORKSPACE` to `workspace.dedicatedQueue === true` (passed as a boolean argument by callers). `getOrCreateWorkspaceQueue`, `setupWorkspaceQueue`, `teardownWorkspaceQueue`, `initBullBoard`, and `getWorkspaceQueueEventsProducer` are retained with same signatures.
- **`packages/server/src/queue/queueUtils.ts`** _(new file)_ — Centralises all queue routing logic: `getWorkspaceQueue(type, workspaceOrId, queueManager, dataSource?)` resolves dedicated vs. shared queue; `isDedicatedQueue(workspaceId, dataSource)` with a 30-second in-process TTL cache to avoid redundant DB reads; `invalidateDedicatedQueueCache(workspaceId)` called by `updateWorkspace` on toggle. No controller or service imports `QueueManager` directly for routing — all routing goes through this module.
- **`packages/server/src/utils/buildChatflow.ts`** — Routing condition becomes `MODE=queue && isDedicatedQueue(workspaceId)`; falls back to shared queue otherwise.
- **`packages/server/src/services/documentstore/index.ts`** and **`nodes/index.ts`** — Same condition change.
- **`packages/server/src/services/agentflowv2-generator/index.ts`** — `QUEUE_DEDICATED_WORKSPACE` branch removed; routes to shared `prediction` queue unconditionally when `MODE=queue`.
- **`packages/server/src/utils/upsertVector.ts`** — Routing condition becomes `MODE=queue && workspace.dedicatedQueue === true`.
- **`packages/server/src/controllers/internal-predictions/index.ts`** and **`predictions/index.ts`** — `redisSubscriber.subscribe(chatId)` guarded by `MODE=queue` only (single condition, no dual-mode check needed).
- **`packages/server/src/services/chat-messages/index.ts`** — `abortChatMessage(chatId, chatflowid, workspaceId?)` — abort routing: when `MODE=queue` and workspace has `dedicatedQueue=true`, publish to workspace-specific `QueueEventsProducer`; otherwise use shared producer.
- **`packages/server/src/controllers/chat-messages/index.ts`** — Unchanged; continues to pass `req.user?.activeWorkspaceId`.
- **`packages/server/src/CachePool.ts`** — `isQueueMode()` helper simplifies to `process.env.MODE === MODE.QUEUE`; no dual-mode logic.
- **`packages/server/src/UsageCacheManager.ts`** and **`utils/rateLimit.ts`** — All guards simplify to `MODE=queue` only.
- **`packages/server/src/custom-rbac/services/workspace-management/index.ts`** — Teardown guard changes from `MODE=QUEUE_DEDICATED_WORKSPACE` to `MODE=queue && workspace.dedicatedQueue === true`.
- **`packages/server/src/database/migrations/`** — New migration adding `dedicatedQueue BOOLEAN NOT NULL DEFAULT FALSE` column to the `workspace` table.
- **`packages/server/src/database/entities/Workspace.ts`** — Add `@Column({ default: false }) dedicatedQueue: boolean` field.
- **`packages/server/src/custom-rbac/services/workspace-management/index.ts`** — `createWorkspace()` and `updateWorkspace()` accept and persist `dedicatedQueue` from the request body.
- **`packages/server/src/custom-rbac/controllers/workspace-management/index.ts`** — `createWorkspace` and `updateWorkspace` controllers read `dedicatedQueue` from `req.body` and pass through to the service.

### Frontend
- **`packages/ui/src/`** — Workspace create/edit form gains an "Enable dedicated worker queue" checkbox/toggle. The toggle is wired to the `dedicatedQueue` field in the API request body. Tooltip explains: _"Routes this workspace's jobs to a dedicated BullMQ queue. Requires a worker started with `WORKER_WORKSPACE_ID=<this workspace ID>`."_
- The workspace table gains a **"Worker Queue" column** positioned between Users and Last Updated. Rows with `dedicatedQueue=true` display a `Dedicated` outlined chip; rows with `dedicatedQueue=false` display muted `Shared` text. The previous inline "Dedicated Queue" chip in the Name column is removed.

### Configuration
- **`docker/.env.example`** and **`packages/server/.env.example`** — Remove `queue-dedicated-workspace` from `MODE` comment; comment becomes `# MODE=queue #(queue | main)`. `WORKER_WORKSPACE_ID` comment updated to clarify it is used for dedicated queues within `MODE=queue`.
- **`docker/worker/.env.example`** — Same MODE comment update. `WORKER_WORKSPACE_ID` description retained.

### Performance Considerations

- **Zero extra DB reads on the hot path** — producer call-sites that already hold the `Workspace` entity (the majority) pass it directly to `getWorkspaceQueue`; no additional DB round-trip is incurred.
- **TTL cache for the remaining call-sites** — where only `workspaceId` is available, `isDedicatedQueue` uses a module-level 30-second in-process cache. The cache is invalidated immediately when `updateWorkspace` changes `dedicatedQueue`, so toggle propagation is near-instant.
- **No cross-replica cache inconsistency** — the cache is per-process and TTL-bounded; in a multi-replica server deployment, a toggle change takes at most 30 seconds to propagate to all replicas, which is acceptable for a rarely-changed configuration flag.
- **Shared IORedis connection pool (deferred)** — at ≥ 20 dedicated workspaces, each `Queue`+`QueueEvents` pair opens 2 Redis connections by default (~80 connections at 20 workspaces). BullMQ supports a shared `IORedis` instance; this optimisation is documented in `QueueManager` via a `TODO` comment and deferred to a follow-up iteration.

### Backward compatibility
- Existing `MODE=queue` deployments are unaffected — `dedicatedQueue` defaults to `false` for all existing workspaces.
- The `QUEUE_DEDICATED_WORKSPACE` enum value and all associated dual-mode guard code are removed; `MODE=queue` is the single queue mode.
- Workers using `WORKER_WORKSPACE_ID` continue to work without change.
