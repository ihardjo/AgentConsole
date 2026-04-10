```markdown
## Requirements

### Requirement: Jobs SHALL be enqueued to a workspace-scoped queue when the workspace has `dedicatedQueue` enabled

When the server enqueues a prediction or upsert job and `MODE=queue`, the system SHALL route the job to a workspace-scoped BullMQ queue if and only if the job's workspace has `dedicatedQueue=true` in the database.

#### Scenario: Job enqueued for a workspace with `dedicatedQueue=true`

- **WHEN** the server calls `addJob()` for a prediction or upsert operation, `MODE=queue`, and the workspace record has `dedicatedQueue=true`
- **THEN** the job SHALL be added to the queue named `<QUEUE_NAME>-<workspaceId>-<type>` (e.g., `flowise-queue-<workspaceId>-prediction`)

#### Scenario: Job enqueued for a workspace with `dedicatedQueue=false` (default)

- **WHEN** `MODE=queue` and the workspace record has `dedicatedQueue=false` (or the field is absent)
- **THEN** the job SHALL be added to the shared global queue (`<QUEUE_NAME>-prediction` or `<QUEUE_NAME>-upsertion`) — preserving all existing shared-queue behaviour unchanged

#### Scenario: Dedicated queue does not yet exist for a workspace

- **WHEN** the server routes a job to a workspace-scoped queue that has not been created yet
- **THEN** the system SHALL lazily create and register a new `PredictionQueue` or `UpsertQueue` instance for that workspace before enqueuing the job

#### Scenario: Job dispatched via `getWorkspaceQueue` with a `workspaceId` string but no `dataSource`

- **WHEN** `getWorkspaceQueue(type, workspaceId, queueManager)` is called with a string `workspaceId` and `dataSource` is absent
- **THEN** the system SHALL throw an explicit `Error('dataSource is required when workspaceOrId is a string')` — no silent fallback to the shared queue

#### Scenario: `executeCustomFunction` called without a `workspaceId`

- **WHEN** `nodes/index.ts::executeCustomFunction` runs in `MODE=queue` and `workspaceId` is `undefined`
- **THEN** the system SHALL route the job to the shared `prediction` queue directly via `queueManager.getQueue('prediction')` — the call to `getWorkspaceQueue` is skipped entirely to avoid a DB lookup for an empty-string workspace ID

### Requirement: Queue routing SHALL be data-driven via `workspace.dedicatedQueue`

The routing decision (shared queue vs. workspace-scoped queue) SHALL be determined by reading `Workspace.dedicatedQueue` from the database at job-dispatch time. There SHALL be no separate `MODE` value for dedicated queue routing.

#### Scenario: `dedicatedQueue` cache invalidated on workspace update

- **WHEN** `WorkspaceManagementService.updateWorkspace()` persists a change to `dedicatedQueue`
- **THEN** `invalidateDedicatedQueueCache(workspaceId)` SHALL be called immediately after `commitTransaction()` so the next job dispatch reflects the updated value without waiting for the 30-second TTL

### Requirement: QueueManager SHALL expose a workspace-aware queue accessor

The `QueueManager` SHALL provide a method `getOrCreateWorkspaceQueue(type, workspaceId)` that returns the `BaseQueue` instance for the given type and workspace.

#### Scenario: Workspace queue already registered

- **WHEN** `getOrCreateWorkspaceQueue('prediction', '<workspaceId>')` is called and a queue for that workspace already exists in the cache
- **THEN** the existing queue instance SHALL be returned without creating a new one

#### Scenario: Workspace queue not yet registered

- **WHEN** `getOrCreateWorkspaceQueue('prediction', '<workspaceId>')` is called and no queue exists for that workspace
- **THEN** a new `PredictionQueue` SHALL be instantiated with name `<QUEUE_NAME>-<workspaceId>-prediction`, registered in the queues map, and returned

### Requirement: Workspace queue names SHALL follow a deterministic naming convention

The system SHALL name workspace-scoped queues using the pattern `<QUEUE_NAME>-<workspaceId>-<type>` where `<type>` is `prediction` or `upsertion`.

#### Scenario: Prediction queue naming

- **WHEN** a workspace queue is created for type `prediction` with `workspaceId` `ws-xyz`
- **THEN** the BullMQ queue name SHALL be `<QUEUE_NAME>-ws-xyz-prediction`

#### Scenario: Upsert queue naming

- **WHEN** a workspace queue is created for type `upsert` with `workspaceId` `ws-xyz`
- **THEN** the BullMQ queue name SHALL be `<QUEUE_NAME>-ws-xyz-upsertion`

### Requirement: BullBoard dashboard SHALL reflect all registered queues

The BullBoard monitoring dashboard SHALL display all queues registered by the `QueueManager` — both the shared global queues and any per-workspace dedicated queues.

#### Scenario: New workspace queue registered after server startup

- **WHEN** `getOrCreateWorkspaceQueue()` creates a new queue at runtime
- **THEN** the new queue SHALL be added to the BullBoard adapter list incrementally via `bullBoardApi.addQueue()` — not via a full-map rebuild

### Requirement: Workspace queues SHALL be torn down when a workspace with `dedicatedQueue=true` is deleted

When a workspace is deleted and its `dedicatedQueue` flag is `true` and `MODE=queue`, the system SHALL obliterate the workspace-scoped queues from Redis, close the associated `QueueEvents` connections, deregister the queues from the `QueueManager` cache, and remove them from BullBoard.

#### Scenario: Workspace with `dedicatedQueue=true` deleted with no active jobs

- **WHEN** `WorkspaceManagementService.deleteWorkspace()` is called for a workspace with `dedicatedQueue=true` and `MODE=queue`
- **AND** the workspace has no active (running) jobs in its prediction or upsert queue
- **THEN** `QueueManager.teardownWorkspaceQueue(workspaceId)` SHALL be called after the database transaction commits (fire-and-forget via `.catch(logger.warn)`)
- **AND** both workspace queues SHALL be obliterated from Redis, their `QueueEvents` connections closed, both queue instances removed from the `QueueManager` cache, and their BullBoard registrations removed via `bullBoardApi.replaceQueues()`

#### Scenario: Workspace with `dedicatedQueue=true` deleted while jobs are active

- **WHEN** workspace deletion is triggered and one or more jobs are in `active` state
- **THEN** the system SHALL log a warning listing the active job IDs
- **AND** obliterate SHALL still proceed with `{ force: true }` — active jobs are abandoned, not waited on

#### Scenario: Workspace with `dedicatedQueue=false` deleted

- **WHEN** `deleteWorkspace()` is called for a workspace with `dedicatedQueue=false`
- **THEN** `teardownWorkspaceQueue` SHALL NOT be called — no dedicated queues exist

#### Scenario: Workspace with `dedicatedQueue=true` has no queue registered (queue never created)

- **WHEN** `QueueManager.teardownWorkspaceQueue(workspaceId)` is called and the workspace has no queue entry in the cache
- **THEN** the system SHALL silently no-op and return without error

#### Scenario: `deleteWorkspaceById` (transactional helper) called for a workspace with `dedicatedQueue=true`

- **WHEN** `deleteWorkspaceById(queryRunner, workspaceId)` is called inside a caller's outer transaction
- **THEN** `teardownWorkspaceQueue` SHALL NOT be called automatically by this method
- **AND** the caller is responsible for invoking `QueueManager.getInstance().teardownWorkspaceQueue(workspaceId)` after their outer transaction commits, as documented in the JSDoc for this method

### Requirement: The `dedicatedQueue` toggle SHALL be persisted in the database

The `dedicatedQueue` field SHALL be a boolean column on the `Workspace` table with a default value of `false`. It SHALL be readable and writable via the workspace create and update APIs.

#### Scenario: New workspace created without specifying `dedicatedQueue`

- **WHEN** a new workspace is created without the `dedicatedQueue` field in the request body
- **THEN** the workspace SHALL be created with `dedicatedQueue=false` and all jobs routed to the shared queue

#### Scenario: New workspace created with `dedicatedQueue=true`

- **WHEN** a new workspace is created with `dedicatedQueue=true` in the request body
- **THEN** the workspace record SHALL persist `dedicatedQueue=true`, and all subsequent jobs for this workspace with `MODE=queue` SHALL be routed to the workspace-scoped queue

### Requirement: BullBoard dashboard SHALL only be accessible when explicitly enabled

The `/admin/queues` route SHALL only be registered when all three conditions are met: `MODE=queue`, `ENABLE_BULLMQ_DASHBOARD=true`, and the platform is not Cloud (`!identityManager.isCloud()`).

#### Scenario: Any guard condition is false

- **WHEN** any one of `MODE=queue`, `ENABLE_BULLMQ_DASHBOARD=true`, or `!isCloud()` is not satisfied
- **THEN** the `/admin/queues` route SHALL NOT be registered in Express — requests to that path fall through to the React SPA handler
```
