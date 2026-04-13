## Context

AgentConsole runs in two modes: `main` (single-process) and `queue` (Redis/BullMQ). In queue mode, all workspaces share a single `flowise-queue-prediction` queue and a single `flowise-queue-upsertion` queue. `QueueManager` is a singleton that holds exactly two `BaseQueue` instances. Workers consume from these global queues with a configurable `WORKER_CONCURRENCY`.

The problem: a single high-throughput workspace monopolises the shared queue causing latency spikes for every other workspace. There is no built-in mechanism to prioritise, rate-limit, or isolate work at the workspace level.

This change introduces **per-workspace queue isolation as an opt-in database flag** — a new `dedicatedQueue: boolean` column on the `Workspace` entity. When enabled for a workspace, the server routes that workspace's jobs to dedicated BullMQ queues. All other workspaces continue using the shared queue. There is no new `MODE` value; `MODE=queue` remains the single queue mode.

Stakeholders: platform ops, enterprise tenants requiring SLA isolation.

## Goals / Non-Goals

**Goals:**

- Introduce a `dedicatedQueue` boolean column on the `Workspace` table (default `false`); expose it as an "Enable dedicated worker queue" toggle on the workspace create/edit form; surface the queue type in the workspace table as a dedicated "Worker Queue" column.
- When `MODE=queue` and `workspace.dedicatedQueue === true`, the server routes jobs to `<QUEUE_NAME>-<workspaceId>-prediction` / `<QUEUE_NAME>-<workspaceId>-upsertion`.
- When `MODE=queue` and `workspace.dedicatedQueue === false` (default), behaviour is identical to today — shared global queue, no change.
- Each dedicated worker process is dedicated to **exactly one workspace queue** (1 worker : 1 queue). Configured via `WORKER_WORKSPACE_ID`.
- Workers are started manually or by an external orchestrator when a workspace's `dedicatedQueue` toggle is enabled.
- `QUEUE_DEDICATED_WORKSPACE` MODE enum value is eliminated — `MODE=queue` is the single queue mode.
- BullBoard dashboard enumerates all registered queues (shared + per-workspace dedicated).
- Backward-compatible: all existing `MODE=queue` deployments with no `dedicatedQueue` workspaces are unaffected.

**Non-Goals:**

- Dynamic runtime discovery of new workspaces without restart (out of scope; handled by external orchestrator or manual ops).
- Per-workspace rate limiting or priority tiers (future work).
- Changes to the `main` (non-queue) mode.
- Cross-workspace job stealing / fallback when a workspace queue is empty.
- Orchestrator-managed worker lifecycle (Kubernetes HPA, etc.).

## Decisions

### Decision 1 — Queue naming convention: `<QUEUE_NAME>-<workspaceId>-<type>`

**Chosen**: Insert `workspaceId` as the second segment of the queue name, before the type (e.g., `flowise-queue-<workspaceId>-prediction`).

**Alternatives considered**:
- `<QUEUE_NAME>-<type>-<workspaceId>` — places type before workspaceId; ruled out in favour of grouping all queues for a workspace together lexicographically.
- Flat name `<QUEUE_NAME>-<workspaceId>` — loses the prediction/upsertion type distinction; ruled out.
- Single queue with job metadata filters — BullMQ workers cannot selectively consume by job payload; ruled out.

**Rationale**: Placing `workspaceId` before `type` groups all queues belonging to a workspace together when sorted alphabetically (e.g., in BullBoard and Redis key listings). Deterministic from both producer and consumer sides. Workers can derive the queue name from `WORKER_WORKSPACE_ID` alone.

### Decision 2 — 1 worker process : 1 workspace queue

**Chosen**: Each dedicated worker process manages one prediction BullMQ `Worker` and one upsert BullMQ `Worker` for a single workspace, configured via `WORKER_WORKSPACE_ID`.

**Alternatives considered**:
- Worker serving N workspaces via `WORKSPACE_IDS` (comma-separated) — multiplies Redis connections per process; creates head-of-line blocking across workspaces within the same worker; removed from scope.
- Single shared worker with BullMQ priority queue per workspace — priority queues in BullMQ are per-queue, not per-job metadata; doesn't achieve true isolation; ruled out.

**Rationale**: Strong isolation guarantees. A crashing worker affects only one workspace. Scaling is linear and predictable. Aligns with container-per-tenant deployment models.

**How `WORKER_WORKSPACE_ID` and `QUEUE_NAME` compose**:
- `QUEUE_NAME` is the shared deployment-wide prefix (e.g., `flowise-queue`). Both server and worker must use the same value.
- `WORKER_WORKSPACE_ID` is the tenant identifier scoped to the worker process.
- The actual BullMQ queue name is derived deterministically: `<QUEUE_NAME>-<WORKER_WORKSPACE_ID>-prediction`.
- The worker calls `setupWorkspaceQueue(workspaceId)` (not `setupAllQueues()`), creating **only** the two workspace-scoped queues.

### Decision 3 — `QueueManager.getOrCreateWorkspaceQueue()` as the single producer entry point

**Chosen**: `QueueManager` exposes `getOrCreateWorkspaceQueue(type, workspaceId): BaseQueue`. Lazily creates and caches the queue in the `queues` Map under key `<queueName>:<workspaceId>:<type>`. No registry event is published.

**Rationale**: Single place for queue lifecycle management. Callers (`buildChatflow.ts`, `documentstore`, `nodes`) need no knowledge of naming conventions. Safe from race conditions due to JavaScript's single-threaded execution model.

### Decision 4 — `QueueEventsProducer` and BullBoard per workspace queue

**Chosen**: A `QueueEventsProducer` is created for each workspace prediction queue (required for `abort` event propagation). BullBoard adapters are registered for every queue created by `getOrCreateWorkspaceQueue`.

**Rationale**: Maintains abort-signal propagation semantics unchanged. BullBoard registration is additive and non-breaking.

### Decision 5 — Routing condition is `workspace.dedicatedQueue`, not a separate MODE value

**Chosen**: Eliminate `MODE=queue-dedicated-workspace`. The routing decision is made at the job-dispatch call-site by checking `workspace.dedicatedQueue` (a database field loaded from the `Workspace` entity). `MODE=queue` remains the only queue mode.

**Alternatives considered**:
- Separate `queue-dedicated-workspace` MODE value — requires all infrastructure guards (`CachePool`, `UsageCacheManager`, `RateLimiterManager`, SSE, abort, etc.) to be duplicated for the new MODE; discovered to be error-prone in practice (see Runtime Findings below); ruled out in favour of a per-workspace data-driven flag.
- Auto-detect from `WORKER_WORKSPACE_ID` alone — server has no reliable signal without reading the database; ruled out.

**Rationale**: A per-workspace database flag is more granular, operator-friendly, and does not require deploying a new `MODE` value. Infrastructure code branches on `MODE=queue` only — no dual-mode guards needed anywhere. The routing decision (shared vs. dedicated) is data-driven and can be changed per workspace without a server restart.

**Routing pattern** (all producer call-sites):
```typescript
if (process.env.MODE === MODE.QUEUE) {
    const queue = await getWorkspaceQueue(type, workspace, appServer.queueManager)
    // — or, where only workspaceId is in scope:
    const queue = await getWorkspaceQueue(type, workspaceId, appServer.queueManager, appServer.AppDataSource)
    const job = await queue.addJob(...)
}
```

`getWorkspaceQueue` encapsulates the routing decision:
- Entity path (`Workspace` object passed): reads `workspace.dedicatedQueue` directly — zero DB calls.
- String path (`workspaceId` passed): requires `dataSource`; throws if absent; uses the 30s TTL cache via `isDedicatedQueue`.
- Both paths: return `queueManager.getOrCreateWorkspaceQueue(type, workspaceId)` when `dedicatedQueue=true`, `queueManager.getQueue(type)` otherwise.

**Exception — `nodes/index.ts` (`executeCustomFunction`):**
`workspaceId` may be `undefined` at this call-site. The correct guard is:
```typescript
const queue = workspaceId
    ? await getWorkspaceQueue('prediction', workspaceId, appServer.queueManager, appServer.AppDataSource)
    : appServer.queueManager.getQueue('prediction')
```
Passing `workspaceId ?? ''` (empty string) to `getWorkspaceQueue` would trigger a DB lookup for `id=''` — semantically wrong. The conditional guard prevents this.

### Decision 6 — `dedicatedQueue` column: database migration + entity field

**Chosen**: Add `dedicatedQueue BOOLEAN NOT NULL DEFAULT FALSE` to the `workspace` table via a TypeORM migration. The `Workspace` entity gains `@Column({ default: false }) dedicatedQueue: boolean`. All existing workspace rows default to `false` — no data migration needed.

**Rationale**: Default `false` ensures zero behavioural change for all existing deployments. The column is set via the workspace create/edit API, not via env var, so per-workspace opt-in is granular and does not require a server restart.

### Decision 7 — Worker startup: `WORKER_WORKSPACE_ID` drives dedicated path within `MODE=queue`

**Chosen**: When `MODE=queue` and `WORKER_WORKSPACE_ID` is set, the worker calls `setupWorkspaceQueue(workspaceId)` and operates as a dedicated worker. When `WORKER_WORKSPACE_ID` is absent, the worker calls `setupAllQueues()` and operates as a shared worker. No separate MODE is needed.

**Guard pattern** (`worker.ts`):
```typescript
if (process.env.MODE === MODE.QUEUE) {
    if (process.env.WORKER_WORKSPACE_ID) {
        // dedicated workspace worker path
        await queueManager.setupWorkspaceQueue(workspaceId, options)
    } else {
        // shared worker path — legacy behaviour unchanged
        await queueManager.setupAllQueues(options)
    }
}
```

### Decision 8 — Queue teardown guard: `workspace.dedicatedQueue === true`, not a separate MODE

**Chosen**: When `deleteWorkspace()` or `deleteWorkspaceById()` is called, check `workspace.dedicatedQueue` on the entity being deleted (available in scope before deletion). If `true` and `MODE=queue`, call `QueueManager.teardownWorkspaceQueue(workspaceId)` post-commit.

**Call-site pattern** (`WorkspaceManagementService.deleteWorkspace`):
```typescript
const dedicatedQueue = workspace.dedicatedQueue // read before deletion
await queryRunner.commitTransaction()
if (process.env.MODE === MODE.QUEUE && dedicatedQueue) {
    await QueueManager.getInstance().teardownWorkspaceQueue(id).catch((err) =>
        logger.error(`[QueueManager] Failed to teardown queue for workspace ${id}:`, err)
    )
}
```

**Rationale**: Post-commit placement ensures the queue is only destroyed if the DB row is actually deleted. Fire-and-forget via `.catch()` so a Redis failure never rolls back the successful DB deletion.

## Risks / Trade-offs

- **Redis connection count**: Each `Queue` + `QueueEvents` in BullMQ opens its own connection. 100 dedicated workspaces = ~200 server-side connections. → Mitigation: document Redis `maxclients` sizing; BullMQ shared `IORedis` connection support can be added in a follow-up.
- **Manual worker provisioning**: When a workspace's `dedicatedQueue` toggle is enabled, an operator must manually start a worker (or have an external orchestrator do it). Jobs enqueued before a worker is started will queue up in Redis and be processed once the worker comes online — no jobs are lost.
- **Shared-queue job loss risk if toggle is enabled on an active workspace**: If a workspace already has in-flight jobs on the shared queue when `dedicatedQueue` is toggled `true`, those jobs will complete on the shared queue. New jobs will go to the dedicated queue. The two queues co-exist transiently. → Mitigation: document the recommended sequence: start dedicated worker → toggle `dedicatedQueue=true` → drain shared queue backlog.
- **`isDedicatedQueue` adds a DB read per job dispatch**: Each producer call-site reads the workspace row to check `dedicatedQueue`. → Mitigation: result can be memoised per HTTP request context (passed from controller), or the workspace entity itself passed down through the call stack. A follow-up can add a Redis-cached workspace settings layer.
- **Obliterate abandons active jobs**: `queue.obliterate({ force: true })` removes all Redis keys including jobs currently being processed by a worker. → Mitigation: `teardownWorkspaceQueue` logs a warning with active job IDs before calling obliterate; workspace deletion is an intentional, irreversible admin action — job loss is documented.

## Migration Plan

1. **Deploy new server build with `MODE=queue`** — all workspaces have `dedicatedQueue=false`; behaviour is identical to today. No change.
2. **Enable `dedicatedQueue=true` for a workspace** via the workspace edit form.
3. **Start a dedicated worker** with `MODE=queue` and `WORKER_WORKSPACE_ID=<workspaceId>`.
4. New jobs for that workspace are routed to the dedicated queue and consumed by the dedicated worker.
5. **Rollback for a workspace**: toggle `dedicatedQueue=false`; new jobs revert to the shared queue. The dedicated worker can be shut down once its queue drains.

## Open Questions

- Should the UI warn operators when enabling `dedicatedQueue=true` that a dedicated worker must be running? → **Recommended**: yes, surfaced as a dismissible banner or tooltip (see task 8.5).

## Frontend Design

### Worker Queue column

The workspace table (`packages/ui/src/views/workspacemanagement/index.jsx`) gains a dedicated **"Worker Queue"** column placed between **Users** and **Last Updated**:

| Name | Description | Users | Worker Queue | Last Updated | (actions) |
|------|-------------|-------|--------------|--------------|-----------|
| Acme Corp | ... | 3 | **Dedicated** *(chip)* | May 1st 2025 | ... |
| Default | ... | 1 | Shared *(muted text)* | Apr 20th 2025 | ... |

- When `workspace.dedicatedQueue === true`: renders a `<Chip label='Dedicated' size='small' color='primary' variant='outlined' />`.
- When `workspace.dedicatedQueue === false`: renders `<Typography variant='body2' color='text.secondary'>Shared</Typography>`.
- The previous inline "Dedicated Queue" `<Chip>` that appeared inside the Name cell has been **removed** in favour of this scannable column.
- Skeleton loading rows each gain a corresponding sixth `<StyledTableCell><Skeleton variant='text' /></StyledTableCell>` to keep column alignment.

## Performance Considerations

Every producer call-site that routes a job must know whether the target workspace has `dedicatedQueue=true`. The naïve implementation reads the `Workspace` row from the database at each dispatch. The decisions below address this.

### Decision 9 — Workspace entity pass-through as primary mitigation; in-process TTL cache as fallback

**Chosen**: Callers that already hold the `Workspace` entity (i.e., controllers and services that load a chatflow/workspace before dispatching a job) SHALL pass the entity down the call stack instead of re-loading it. `getWorkspaceQueue(type, workspace)` accepts the full `Workspace` entity rather than just a `workspaceId` string, eliminating the extra DB round-trip in the common case.

**Secondary mitigation — in-memory LRU cache in `queueUtils.ts`**

For call-sites where the workspace entity is not available in scope, `getWorkspaceQueue` SHOULD cache the `dedicatedQueue` flag in a module-level `Map<workspaceId, boolean>` with a short TTL (e.g., 30 seconds). This cache is invalidated explicitly when `WorkspaceManagementService.updateWorkspace()` toggles `dedicatedQueue`.

```typescript
// queueUtils.ts — illustrative
const dedicatedQueueCache = new Map<string, { value: boolean; expiresAt: number }>()

export async function isDedicatedQueue(workspaceId: string, dataSource: DataSource): Promise<boolean> {
    const cached = dedicatedQueueCache.get(workspaceId)
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const workspace = await dataSource.getRepository(Workspace).findOneBy({ id: workspaceId })
    const value = workspace?.dedicatedQueue ?? false
    dedicatedQueueCache.set(workspaceId, { value, expiresAt: Date.now() + 30_000 })
    return value
}

export function invalidateDedicatedQueueCache(workspaceId: string): void {
    dedicatedQueueCache.delete(workspaceId)
}
```

**Rationale**: Keeps the common hot-path (chatflow execution where the workspace is already loaded) at zero extra DB reads. The LRU cache covers edge cases (e.g., abort path) where the workspace entity is not in scope. A dedicated Redis-layer cache is intentionally deferred — the module-level Map is sufficient for single-process server deployments; multi-server deployments already share the DB and the 30-second staleness window is acceptable for a configuration flag that changes rarely.

**Alternatives considered**:
- Pure DB read at every dispatch — correct but adds latency at high throughput; unacceptable for burst workloads; ruled out as default.
- Redis-cached workspace settings — correct and consistent across multiple server replicas; adds a new Redis key space and invalidation logic; deferred to a follow-up as per the Open Questions resolution above.
- Read from `req.user.activeWorkspace` — not available at all call-sites (e.g., upsertVector); ruled out as the sole strategy.

### Decision 10 — `queueUtils.ts` as the single routing abstraction; architectural boundaries

**Chosen**: All queue dispatch logic is centralised in `packages/server/src/queue/queueUtils.ts`. No controller or service imports `QueueManager` directly for the purpose of routing a job. The dependency graph is:

```
controllers / services
       │
       ▼
  queueUtils.ts          ← resolves dedicated vs. shared queue; owns isDedicatedQueue cache
       │
       ▼
  QueueManager           ← owns queue instances, BullBoard adapters, QueueEventsProducers
       │
       ▼
  BullMQ / IORedis
```

**Rules enforced:**
1. **No raw string literals for MODE** — always compare against the `MODE` enum (`MODE.QUEUE`, `MODE.MAIN`). Never `process.env.MODE === 'queue'`.
2. **No `QUEUE_DEDICATED_WORKSPACE` references** — enforced by the verification step in task 11.16.
3. **`QueueManager` is not a service registry** — it owns queue lifecycle only; routing decisions (`isDedicatedQueue`, `getWorkspaceQueue`) belong in `queueUtils.ts`.
4. **Worker imports `QueueManager` directly** — the worker process has no HTTP request context; it is exempt from the controller/service → queueUtils indirection.
5. **`getWorkspaceQueue` is the primary routing export** — `isDedicatedQueue` and `invalidateDedicatedQueueCache` are also exported from `queueUtils.ts` for use by `chat-messages/index.ts` (abort path, no entity in scope) and `workspace-management/index.ts` (cache invalidation on update). Direct calls to `isDedicatedQueue` outside these specific sites are discouraged; prefer passing the `Workspace` entity to `getWorkspaceQueue` on the job-dispatch hot path.

**Shared IORedis connection for BullMQ (deferred follow-up)**

BullMQ opens a separate `IORedis` connection per `Queue` and `QueueEvents` instance by default. At scale (100 dedicated workspaces), this produces ~400 connections (2 `Queue` + 2 `QueueEvents` per workspace). BullMQ supports a shared `IORedis` connection passed as `connection` in `QueueOptions`. This optimisation is intentionally deferred because:
- It requires a BullMQ version ≥ 5.x API audit.
- Connection sharing must be opt-in per queue type to avoid cross-queue event interference.
- The immediate deployment target is ≤ 20 dedicated workspaces; 80 connections is within Redis `maxclients` defaults.

When implemented: `QueueManager` will hold a single `IORedis` instance and pass it to all `Queue`, `Worker`, and `QueueEvents` constructors. Document `REDIS_MAX_CLIENTS` sizing in `docker/worker/README.md`.

## Runtime Findings

The following issues were discovered during an earlier implementation attempt using a separate `queue-dedicated-workspace` MODE value. They are documented here as rationale for Decision 5 (merging back into `MODE=queue`).

### Why a separate MODE value proved error-prone

The original design introduced `MODE=queue-dedicated-workspace` as a distinct enum value. This required extending every Redis-gated infrastructure guard across the codebase to handle two conditions:

| File | Guard that had to be duplicated |
|------|--------------------------------|
| `CachePool.ts` | 11 `MODE.QUEUE` checks → `isQueueMode()` helper |
| `UsageCacheManager.ts` | Redis init guard |
| `utils/rateLimit.ts` | 4 guards: constructor, `addRateLimiter`, `updateRateLimiter`, `initializeRateLimiters` |
| `index.ts` | `initDatabase()` branching, BullBoard route guard |
| `controllers/internal-predictions/index.ts` | `redisSubscriber.subscribe` |
| `controllers/predictions/index.ts` | `redisSubscriber.subscribe` |
| `services/chat-messages/index.ts` | `abortChatMessage` routing |
| `utils/upsertVector.ts` | Queue dispatch |
| `services/agentflowv2-generator/index.ts` | Queue dispatch |

Each missed guard produced a distinct runtime failure (silent SSE, broken abort, in-process cache instead of Redis, etc.). The pattern is inherently fragile: any future infrastructure code that gates on `MODE.QUEUE` must remember to also handle `MODE.QUEUE_DEDICATED_WORKSPACE`.

**Resolution**: Collapse to a single `MODE=queue` and move the shared-vs-dedicated routing decision to `workspace.dedicatedQueue` — a data-driven check that requires no changes to infrastructure guards.

### Decision 11 — Remove all `QUEUE_DEDICATED_WORKSPACE` dead code as part of this change

**Chosen**: Delete every artefact introduced by the earlier `queue-dedicated-workspace` implementation. This is not optional cleanup — leaving the dead code in place creates a misleading signal that the old design is still valid and risks it being accidentally revived.

**Artefacts to remove:**

| Artefact | Location | Action |
|---|---|---|
| `QUEUE_DEDICATED_WORKSPACE = 'queue-dedicated-workspace'` enum value | `Interface.ts` `MODE` enum | Delete |
| `queue-dedicated-workspace` from `MODE` flag docs | `commands/base.ts` | Update comment to `queue \| main` |
| `else if (QUEUE_DEDICATED_WORKSPACE)` init branch | `index.ts` `initDatabase()` | Remove; collapse into `MODE.QUEUE` block |
| `isQueueMode()` helper function | `CachePool.ts` | Delete; inline all uses back to `process.env.MODE === MODE.QUEUE` |
| Dual-mode guards (`MODE.QUEUE || MODE.QUEUE_DEDICATED_WORKSPACE`) | `UsageCacheManager.ts`, `utils/rateLimit.ts` | Simplify each to `MODE.QUEUE` only |
| `QUEUE_DEDICATED_WORKSPACE` routing branches | `buildChatflow.ts`, `documentstore/index.ts`, `nodes/index.ts`, `upsertVector.ts`, `agentflowv2-generator/index.ts` | Replace with `workspace.dedicatedQueue` check |
| `QUEUE_DEDICATED_WORKSPACE` teardown guard | `workspace-management/index.ts` | Replace with `MODE.QUEUE && workspace.dedicatedQueue === true` |
| Dual-mode `redisSubscriber.subscribe` guards | Both prediction controllers | Simplify to `MODE.QUEUE` only |
| `QUEUE_DEDICATED_WORKSPACE` abort dispatch branch | `chat-messages/index.ts` | Replace with `workspace.dedicatedQueue` check |

**Rationale**: The `QUEUE_DEDICATED_WORKSPACE` enum value and all guard patterns referencing it are superseded by the `workspace.dedicatedQueue` database flag. Retaining them would mean the codebase contains two contradictory routing strategies with no runtime path that exercises the old one, making it a maintenance hazard and a source of confusion for future contributors.

**Verification**: After cleanup, a grep for `QUEUE_DEDICATED_WORKSPACE` across `packages/server/src` MUST return zero results. A grep for `queue-dedicated-workspace` (string literal) MUST also return zero results (see task 6.16).
