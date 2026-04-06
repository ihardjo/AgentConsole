## Why

Currently, all workspaces share a single global `prediction` queue and a single global `upsert` queue, meaning one noisy or high-traffic workspace can starve others. As the platform grows to serve multiple tenants, fair isolation of compute resources per workspace becomes critical.

## What Changes

- A new `MODE` value **`queue-dedicated-workspace`** is introduced alongside the existing `queue` (legacy shared queue) and `main` values:
  - `queue` — legacy shared queue behaviour; unchanged.
  - `queue-dedicated-workspace` — per-workspace dedicated queue routing; server routes jobs to workspace-scoped queues; workers use `WORKER_WORKSPACE_ID` to consume from one workspace queue only.
  - `main` — direct single-process mode; unchanged.
- `Interface.ts` `MODE` enum gains a new member: `QUEUE_DEDICATED_WORKSPACE = 'queue-dedicated-workspace'`.
- Workers will consume from **workspace-scoped queues** (e.g., `flowise-queue-prediction-<workspaceId>`) instead of a single shared queue.
- Each worker process is **dedicated to exactly one workspace queue** — 1 worker : 1 queue. Scaling is achieved by deploying additional worker containers.
- The server will **enqueue jobs to the workspace's dedicated queue** rather than the global queue, lazily creating the queue on first use.
- The BullBoard dashboard will enumerate all registered workspace queues.
- `WORKSPACE_IDS` env variable is **removed** — not needed when each worker is dedicated to one queue. Workers are configured via `WORKER_WORKSPACE_ID` (single workspace) instead.
- New workspace workers must be started manually (or via an external orchestrator) when a new workspace is provisioned.

## Capabilities

### New Capabilities

- `workspace-queue-routing`: The server dynamically routes enqueued jobs to the queue dedicated to the job's `workspaceId`, creating the queue instance on first use.
- `workspace-worker-assignment`: Each worker process is assigned to exactly one workspace via `WORKER_WORKSPACE_ID` and is started manually or by an external orchestrator.
- `workspace-queue-teardown`: When a workspace is deleted, its dedicated queues are drained, obliterated from Redis, and removed from BullBoard — keeping Redis clean and preventing orphaned event streams.

### Modified Capabilities

<!-- No existing spec-level requirement changes -->

## Impact

- **`packages/server/src/Interface.ts`** — `MODE` enum gains `QUEUE_DEDICATED_WORKSPACE = 'queue-dedicated-workspace'`.
- **`packages/server/src/commands/base.ts`** — `MODE` flag documentation updated to list all three valid values; `WORKER_WORKSPACE_ID` flag added.
- **`packages/server/src/index.ts`** — `initDatabase()` gains an `else if (QUEUE_DEDICATED_WORKSPACE)` branch that initialises `QueueManager`, `BullBoard`, and `RedisEventSubscriber`; BullBoard Express route guard extended to include dedicated-workspace mode.
- **`packages/server/src/queue/QueueManager.ts`** — New `getOrCreateWorkspaceQueue(type, workspaceId)` method for server-side routing; new `setupWorkspaceQueue(workspaceId, options)` for worker-side initialisation; new `teardownWorkspaceQueue(workspaceId)` for workspace deletion cleanup; new `initBullBoard(serverAdapter)` for initialising BullBoard in dedicated-workspace mode; new `getWorkspaceQueueEventsProducer(workspaceId)` for abort event propagation to per-workspace queues; `setupAllQueues()` unchanged for legacy path.
- **`packages/server/src/queue/BaseQueue.ts`** — No structural changes; queue name convention updated at instantiation time.
- **`packages/server/src/commands/worker.ts`** — Worker reads a single `WORKER_WORKSPACE_ID` env var; when `MODE=queue-dedicated-workspace` creates one prediction worker and one upsert worker for that workspace; handles `closed` event from BullMQ Worker to self-terminate when its queue is obliterated; otherwise falls back to legacy shared-queue behaviour.
- **`packages/server/src/utils/buildChatflow.ts`** and **`packages/server/src/services/documentstore/index.ts`** — Queue lookup passes `workspaceId` to `getOrCreateWorkspaceQueue` when `MODE=queue-dedicated-workspace`.
- **`packages/server/src/services/nodes/index.ts`** — Same queue-lookup change for custom-node execution.
- **`packages/server/src/services/agentflowv2-generator/index.ts`** — Added `QUEUE_DEDICATED_WORKSPACE` branch; routes to the shared `prediction` queue (generation is not workspace-specific).
- **`packages/server/src/utils/upsertVector.ts`** — Added `QUEUE_DEDICATED_WORKSPACE` branch that routes upsert jobs to the workspace-specific upsert queue via `getOrCreateWorkspaceQueue('upsert', workspaceId)`.
- **`packages/server/src/controllers/internal-predictions/index.ts`** and **`packages/server/src/controllers/predictions/index.ts`** — `redisSubscriber.subscribe(chatId)` guard extended to include `MODE.QUEUE_DEDICATED_WORKSPACE` so SSE streaming works in dedicated-workspace mode.
- **`packages/server/src/services/chat-messages/index.ts`** — `abortChatMessage` signature extended to accept optional `workspaceId?`; new `QUEUE_DEDICATED_WORKSPACE` branch publishes to the per-workspace `QueueEventsProducer`.
- **`packages/server/src/controllers/chat-messages/index.ts`** — Updated abort controller to pass `req.user?.activeWorkspaceId` to `abortChatMessage`.
- **`packages/server/src/CachePool.ts`** — Introduced `isQueueMode()` helper; all guards updated to cover both `MODE.QUEUE` and `MODE.QUEUE_DEDICATED_WORKSPACE` so SSO tokens, LLM cache, and embedding cache use Redis in dedicated-workspace mode.
- **`packages/server/src/UsageCacheManager.ts`** — `initialize()` Redis guard extended to include `MODE.QUEUE_DEDICATED_WORKSPACE`.
- **`packages/server/src/utils/rateLimit.ts`** — Constructor Redis init, `addRateLimiter` (RedisStore), `updateRateLimiter` (cross-process publish), and `initializeRateLimiters` (QueueEvents listener) guards all extended to include `MODE.QUEUE_DEDICATED_WORKSPACE`.
- **`packages/server/src/custom-rbac/services/workspace-management/index.ts`** — Both `deleteWorkspace()` and `deleteWorkspaceById()` call `QueueManager.teardownWorkspaceQueue(workspaceId)` after their DB transaction commits, guarded by `MODE=queue-dedicated-workspace`.
- **`docker/worker/.env.example`**, **`docker/.env.example`**, **`packages/server/.env.example`** — `MODE` comment updated to include `queue-dedicated-workspace`; `WORKER_WORKSPACE_ID` entry added under QUEUE CONFIGURATION.
- **Backward compatibility**: When `MODE=queue` (or MODE is absent), all existing shared-queue behaviour is preserved unchanged. No workspace deletion hook is called in legacy mode.
