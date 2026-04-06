## Context

AgentConsole runs in two modes: `direct` (single-process) and `queue` (Redis/BullMQ). In queue mode, all workspaces share a single `flowise-queue-prediction` queue and a single `flowise-queue-upsertion` queue. `QueueManager` is a singleton that holds exactly two `BaseQueue` instances. Workers consume from these global queues with a configurable `WORKER_CONCURRENCY`.

The problem: a single high-throughput workspace monopolises the shared queue causing latency spikes for every other workspace. There is no built-in mechanism to prioritise, rate-limit, or isolate work at the workspace level.

This change introduces a new `MODE` value — **`queue-dedicated-workspace`** — that activates per-workspace queue isolation. The existing `queue` mode retains all current shared-queue behaviour unchanged. The `MODE` enum in `Interface.ts` gains `QUEUE_DEDICATED_WORKSPACE = 'queue-dedicated-workspace'`.

Stakeholders: platform ops, enterprise tenants requiring SLA isolation.

## Goals / Non-Goals

**Goals:**

- Introduce `MODE=queue-dedicated-workspace` as a distinct opt-in value; `MODE=queue` retains all existing shared-queue behaviour unchanged.
- `Interface.ts` `MODE` enum gains `QUEUE_DEDICATED_WORKSPACE = 'queue-dedicated-workspace'`.
- Each workspace gets its own `prediction` and `upsert` BullMQ queue when running in `queue-dedicated-workspace` mode.
- Each worker process is dedicated to **exactly one workspace queue** (1 worker : 1 queue). Horizontal scaling = more worker containers.
- `WORKSPACE_IDS` is removed; workers are configured via a single `WORKER_WORKSPACE_ID` env var.
- Workers are started manually or by an external orchestrator when a new workspace is provisioned.
- Backward-compatible: `MODE=queue` (or MODE absent) falls back entirely to legacy single shared-queue behaviour.
- BullBoard dashboard enumerates all registered workspace queues.

**Non-Goals:**

- Dynamic runtime discovery of new workspaces without restart (out of scope; handled by external orchestrator or manual ops).
- Per-workspace rate limiting or priority tiers (future work).
- Changes to the `direct` (non-queue) mode.
- Cross-workspace job stealing / fallback when a workspace queue is empty.
- Orchestrator-managed worker lifecycle (Kubernetes HPA, etc.).

## Decisions

### Decision 1 — Queue naming convention: `<QUEUE_NAME>-<type>-<workspaceId>`

**Chosen**: Append `workspaceId` as the third segment of the queue name (e.g., `flowise-queue-prediction-ws-abc123`).

**Alternatives considered**:
- Flat name `<QUEUE_NAME>-<workspaceId>` — loses the prediction/upsertion type distinction; ruled out.
- Single queue with job metadata filters — BullMQ workers cannot selectively consume by job payload; ruled out.

**Rationale**: Deterministic from both producer and consumer sides. Keeps the existing two-queue-type model. Workers can derive the queue name from `WORKER_WORKSPACE_ID` alone.

### Decision 2 — 1 worker process : 1 workspace queue

**Chosen**: Each worker process manages one prediction BullMQ `Worker` and one upsert BullMQ `Worker` for a single workspace, configured via `WORKER_WORKSPACE_ID`.

**Alternatives considered**:
- Worker serving N workspaces via `WORKSPACE_IDS` (comma-separated) — multiplies Redis connections per process; creates head-of-line blocking across workspaces within the same worker; removed from scope.
- Single shared worker with BullMQ priority queue per workspace — priority queues in BullMQ are per-queue, not per-job metadata; doesn't achieve true isolation; ruled out.

**Rationale**: Strong isolation guarantees. A crashing worker affects only one workspace. Scaling is linear and predictable. Aligns with container-per-tenant deployment models.

**How `WORKER_WORKSPACE_ID` and `QUEUE_NAME` compose**:
- `QUEUE_NAME` is the shared deployment-wide prefix (e.g., `flowise-queue`). Both server and worker must use the same value.
- `WORKER_WORKSPACE_ID` is the tenant identifier scoped to the worker process.
- The actual BullMQ queue name is derived deterministically: `<QUEUE_NAME>-prediction-<WORKER_WORKSPACE_ID>`. No additional env var is needed — the worker constructs its queue names from these two existing values.
- In workspace mode the worker calls `setupWorkspaceQueue(workspaceId)` (not `setupAllQueues()`), creating **only** the two workspace-scoped queues. `setupAllQueues()` is reserved for the legacy shared-queue worker path.

### Decision 3 — `QueueManager.getOrCreateWorkspaceQueue()` as the single producer entry point

**Chosen**: `QueueManager` exposes `getOrCreateWorkspaceQueue(type, workspaceId): BaseQueue`. Lazily creates and caches the queue in the `queues` Map under key `<type>:<workspaceId>`. No registry event is published.

**Rationale**: Single place for queue lifecycle management. Callers (`buildChatflow.ts`, `documentstore`, `nodes`) need no knowledge of naming conventions. Safe from race conditions due to JavaScript's single-threaded execution model.

### Decision 4 — `QueueEventsProducer` and BullBoard per workspace queue

**Chosen**: A `QueueEventsProducer` is created for each workspace prediction queue (required for `abort` event propagation). BullBoard adapters are registered for every queue created by `getOrCreateWorkspaceQueue`.

**Rationale**: Maintains abort-signal propagation semantics unchanged. BullBoard registration is additive and non-breaking.

### Decision 5 — New `queue-dedicated-workspace` MODE value; existing `queue` MODE unchanged

**Chosen**: Introduce `MODE=queue-dedicated-workspace` as a separate, opt-in mode value. The existing `MODE=queue` (shared single-queue) path is **not modified**. Code forks on `process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE`.

**Alternatives considered**:
- Overload existing `MODE=queue` and use presence of `WORKER_WORKSPACE_ID` to activate workspace routing — conflates two independent concerns; makes the server's routing behaviour unpredictable depending on a worker-side env var; ruled out.
- Auto-detect workspace mode from `WORKER_WORKSPACE_ID` only, without a MODE flag — server has no reliable signal to switch its producer routing; a server deployed in shared mode could silently route to workspace queues if a stray env var is present; ruled out.

**Rationale**: Explicit MODE values make deployment intent unambiguous. Operators choose `queue` (legacy shared) or `queue-dedicated-workspace` (workspace isolation) at deploy time. No accidental mixing. Easy to document, observe in logs, and gate in config validators.

**MODE enum addition** (`packages/server/src/Interface.ts`):
```typescript
export enum MODE {
    QUEUE = 'queue',
    QUEUE_DEDICATED_WORKSPACE = 'queue-dedicated-workspace',
    MAIN = 'main'
}
```

**Guard pattern** (server producer + worker):
```typescript
if (process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE && workspaceId) {
    return queueManager.getOrCreateWorkspaceQueue(type, workspaceId)
}
// fall through to legacy getQueue()
```

> **Note**: Always compare against the `MODE` enum constant (`MODE.QUEUE_DEDICATED_WORKSPACE`), never the raw string literal, so the TypeScript compiler enforces validity.

### Decision 6 — Queue teardown on workspace deletion: post-commit, fire-and-forget obliterate

**Chosen**: When a workspace is deleted and `MODE=queue-dedicated-workspace`, `QueueManager.teardownWorkspaceQueue(workspaceId)` is called **after** the database transaction commits. It performs:
1. Fetch active job count from the workspace queues; log a warning if any are active.
2. Call `queue.obliterate({ force: true })` on both workspace queues (removes all jobs and Redis keys).
3. Close the `QueueEvents` connection for each queue.
4. Remove both queue instances from the `queues` Map cache.
5. Remove their BullBoard adapter registrations.

The teardown is invoked from `WorkspaceManagementService.deleteWorkspace()` and `deleteWorkspaceById()`, after `queryRunner.commitTransaction()` in each path.

**Alternatives considered**:
- Teardown inside the DB transaction — `obliterate` is a Redis operation, not a SQL operation; mixing it into a `QueryRunner` transaction gives false transactional guarantees and can block the DB connection on slow Redis; ruled out.
- Defer to a scheduled cleanup job — introduces a window where a deleted workspace's queue still shows in BullBoard and still accepts new jobs from a misconfigured producer; ruled out.
- Let operators clean up manually — stale queues accumulate Redis memory; orphaned BullMQ event streams grow unboundedly; ruled out.

**Rationale**: Post-commit placement ensures the queue is only destroyed if the DB row is actually deleted. Fire-and-forget is acceptable because: (a) obliterate failure leaves an orphaned queue that is harmless (idle), (b) any error is logged for operator action, (c) no user-facing HTTP response depends on the Redis outcome.

**`teardownWorkspaceQueue` signature** (`QueueManager`):
```typescript
public async teardownWorkspaceQueue(workspaceId: string): Promise<void>
```

**Call-site pattern** (`WorkspaceManagementService.deleteWorkspace`):
```typescript
await queryRunner.commitTransaction()
// DB transaction is committed — now safely tear down Redis state
if (process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE) {
    await QueueManager.getInstance().teardownWorkspaceQueue(id).catch((err) =>
        logger.error(`[QueueManager] Failed to teardown queue for workspace ${id}:`, err)
    )
}
```

**BullBoard deregistration**: BullBoard's `ExpressAdapter` does not currently support removing individual queues at runtime. The implementation SHALL call `serverAdapter.setQueues(remainingAdapters)` with the workspace queues filtered out, using the existing `serverAdapter` reference stored on `QueueManager`.

## Risks / Trade-offs

- **Redis connection count**: Each `Queue` + `QueueEvents` in BullMQ opens its own connection. 100 workspaces = ~200 server-side connections. → Mitigation: document Redis `maxclients` sizing; BullMQ shared `IORedis` connection support can be added in a follow-up.
- **Manual worker provisioning**: When a new workspace is created, an operator must manually start a worker (or have an external orchestrator do it). Jobs enqueued before a worker is started will queue up in Redis and be processed once the worker comes online — no jobs are lost. → Mitigation: document the provisioning runbook in `docker/worker/README.md`.
- **Legacy fallback gap**: Jobs enqueued to workspace queues will never be consumed by a legacy worker. During rolling deployments, server and workers must be updated together. → Mitigation: documented in migration plan; no silent fallback by design.
- **Obliterate abandons active jobs**: `queue.obliterate({ force: true })` removes all Redis keys including jobs currently being processed by a worker. Any in-flight job will not have its completion recorded. → Mitigation: (a) `teardownWorkspaceQueue` logs a warning with active job IDs before calling obliterate, giving operators visibility; (b) workspace deletion is an intentional, irreversible admin action — job loss is an expected and documented consequence; (c) any partially-completed side-effects (DB writes, vector store mutations) must be handled idempotently by the job processor.
- **Queue teardown is outside the DB transaction**: `obliterate` is called after `queryRunner.commitTransaction()`. If the Redis call fails, the workspace row is already deleted but its queues remain in Redis. → Mitigation: the orphaned queues are idle (no worker processes them after deletion); errors are caught and logged; an operator can manually call `queue.obliterate()` to clean up; the `teardownWorkspaceQueue` call is wrapped in `.catch()` so it never rolls back the successful DB deletion.

## Migration Plan

1. **Deploy new server build with `MODE=queue`** — server continues to use legacy shared queues; all in-flight jobs are not lost. No behaviour change.
2. **Switch server to `MODE=queue-dedicated-workspace`** — server now routes new jobs to workspace-scoped queues. Legacy global queues remain registered; jobs already in them drain normally.
3. **Start per-workspace workers** — for each workspace, deploy a worker container with `MODE=queue-dedicated-workspace` and `WORKER_WORKSPACE_ID=<workspaceId>`.
4. **Drain legacy queues** — monitor BullBoard; once `flowise-queue-prediction` and `flowise-queue-upsertion` are empty, shut down legacy workers.
5. **Rollback**: Set `MODE=queue` on both server and workers; redeploy. Workspace-scoped queues idle harmlessly in Redis.

## Open Questions

- Should BullMQ `IORedis` connection sharing be implemented immediately to cap Redis connections, or deferred to a follow-up?
- Should a workspace deletion hook call `queue.obliterate()` to clean up idle workspace queues from Redis?

## Runtime Findings

The following issues were discovered during end-to-end testing and resolved as part of this change. Each represents a place in the codebase where an existing `MODE.QUEUE`-only guard was not extended to cover `MODE.QUEUE_DEDICATED_WORKSPACE`.

### Decision 7 — Infrastructure guards must cover both `MODE.QUEUE` and `MODE.QUEUE_DEDICATED_WORKSPACE`

**Finding**: Several infrastructure subsystems — `CachePool`, `UsageCacheManager`, `RateLimiterManager`, and the abort path — gated their Redis-backed behaviour exclusively on `process.env.MODE === MODE.QUEUE`. In `queue-dedicated-workspace` mode these fell through to their in-memory fallback paths, causing:

| Symptom | Root cause |
|---------|-----------|
| Server crash on first request: `Cannot read properties of undefined (reading 'getOrCreateWorkspaceQueue')` | `index.ts` `initDatabase()` never assigned `this.queueManager` in dedicated-workspace mode |
| SSE streaming silent — no tokens or events reached the browser | `redisSubscriber.subscribe(chatId)` guard in both prediction controllers only matched `MODE.QUEUE` |
| BullBoard dashboard returned 404 | BullBoard router never mounted; `initBullBoard()` not called in dedicated-workspace mode |
| Abort had no effect — job continued running | `abortChatMessage` published to the shared-queue `QueueEventsProducer`; dedicated-workspace jobs require publishing to the per-workspace `QueueEventsProducer` |
| Cache misses across server/worker boundary | `CachePool` used in-memory maps instead of Redis; SSO tokens, LLM cache, and embedding cache were not shared |
| Usage counters not shared across processes | `UsageCacheManager` initialised in-memory instead of Redis-backed |
| Rate limit updates not propagated to workers | `RateLimiterManager` skipped Redis init, RedisStore, and cross-process `QueueEventsProducer.publishEvent` in dedicated-workspace mode |

**Resolution**: Each affected file was updated to treat `MODE.QUEUE_DEDICATED_WORKSPACE` identically to `MODE.QUEUE` for all Redis-infrastructure concerns. Where many guards exist in a single file (e.g., `CachePool.ts`), a module-level helper `isQueueMode()` was introduced to avoid repetition:

```typescript
const isQueueMode = () =>
    process.env.MODE === MODE.QUEUE || process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE
```

**New public API on `QueueManager`**:

- `initBullBoard(serverAdapter: ExpressAdapter): void` — initialises BullBoard with an empty queue list in dedicated-workspace mode (in `queue` mode this is done by `setupAllQueues`)
- `getWorkspaceQueueEventsProducer(workspaceId: string): QueueEventsProducer` — retrieves the per-workspace `QueueEventsProducer` from `workspaceQueueEventsProducers` map; used by the abort path

**Abort path change**: `abortChatMessage(chatId, chatflowid)` signature extended to `abortChatMessage(chatId, chatflowid, workspaceId?)`. The controller passes `req.user?.activeWorkspaceId`. The service dispatches to:

1. `getWorkspaceQueueEventsProducer(workspaceId)` when `MODE.QUEUE_DEDICATED_WORKSPACE` and `workspaceId` is present
2. `getPredictionQueueEventsProducer()` when `MODE.QUEUE` (legacy shared queue)
3. `abortControllerPool.abort(id)` for non-queue (direct) mode

**Guard pattern** adopted across all newly extended sites:
```typescript
if (process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE) {
    // Redis / per-workspace path
} else if (process.env.MODE === MODE.QUEUE) {
    // Redis / shared-queue path
} else {
    // In-memory / direct path
}
```

> **Rule**: Any code that branches on `MODE.QUEUE` to use Redis, BullMQ, or cross-process signalling MUST include a corresponding `MODE.QUEUE_DEDICATED_WORKSPACE` branch. When in doubt, search for `MODE\.QUEUE[^_]` in `packages/server/src` and verify each hit.
