## ADDED Requirements

### Requirement: Jobs SHALL be enqueued to a workspace-scoped queue when MODE is `queue-dedicated-workspace`

When the server enqueues a prediction or upsert job and `MODE=queue-dedicated-workspace`, the system SHALL route the job to a BullMQ queue whose name includes the job's `workspaceId`.

#### Scenario: Job enqueued in `queue-dedicated-workspace` mode with a known workspaceId

- **WHEN** the server calls `addJob()` for a prediction or upsert operation, `MODE=queue-dedicated-workspace`, and `workspaceId` is present in the job data
- **THEN** the job SHALL be added to the queue named `<QUEUE_NAME>-<type>-<workspaceId>` (e.g., `flowise-queue-prediction-ws-abc123`)

#### Scenario: Queue does not yet exist for a workspace

- **WHEN** the server routes a job to a workspace-scoped queue that has not been created yet
- **THEN** the system SHALL lazily create and register a new `PredictionQueue` or `UpsertQueue` instance for that workspace before enqueuing the job

#### Scenario: Job enqueued in `queue` mode (legacy fallback)

- **WHEN** `MODE=queue` (or MODE is absent/unrecognised)
- **THEN** the job SHALL be added to the legacy global queue (`<QUEUE_NAME>-prediction` or `<QUEUE_NAME>-upsertion`) regardless of whether `workspaceId` is present — preserving all existing shared-queue behaviour unchanged

#### Scenario: Job enqueued in `queue-dedicated-workspace` mode without a workspaceId

- **WHEN** `MODE=queue-dedicated-workspace` and `workspaceId` is absent or empty
- **THEN** the job SHALL fall back to the legacy global queue to prevent job loss

### Requirement: QueueManager SHALL expose a workspace-aware queue accessor

The `QueueManager` SHALL provide a method `getOrCreateWorkspaceQueue(type, workspaceId)` that returns the `BaseQueue` instance for the given type and workspace.

#### Scenario: Workspace queue already registered

- **WHEN** `getOrCreateWorkspaceQueue('prediction', 'ws-abc123')` is called and a queue for that workspace already exists in the cache
- **THEN** the existing queue instance SHALL be returned without creating a new one

#### Scenario: Workspace queue not yet registered

- **WHEN** `getOrCreateWorkspaceQueue('prediction', 'ws-abc123')` is called and no queue exists for that workspace
- **THEN** a new `PredictionQueue` SHALL be instantiated with name `<QUEUE_NAME>-prediction-ws-abc123`, registered in the queues map, and returned

### Requirement: Workspace queue names SHALL follow a deterministic naming convention

The system SHALL name workspace-scoped queues using the pattern `<QUEUE_NAME>-<type>-<workspaceId>` where `<type>` is `prediction` or `upsertion`.

#### Scenario: Prediction queue naming

- **WHEN** a workspace queue is created for type `prediction` with workspaceId `ws-xyz`
- **THEN** the BullMQ queue name SHALL be `<QUEUE_NAME>-prediction-ws-xyz`

#### Scenario: Upsert queue naming

- **WHEN** a workspace queue is created for type `upsert` with workspaceId `ws-xyz`
- **THEN** the BullMQ queue name SHALL be `<QUEUE_NAME>-upsertion-ws-xyz`

### Requirement: BullBoard dashboard SHALL reflect all registered workspace queues

The BullBoard monitoring dashboard SHALL display all workspace-scoped queues that have been registered by the `QueueManager`.

#### Scenario: New workspace queue registered after server startup

- **WHEN** `getOrCreateWorkspaceQueue()` creates a new queue at runtime
- **THEN** the new queue SHALL be added to the BullBoard adapter list so it appears in the dashboard

### Requirement: Workspace queues SHALL be torn down when a workspace is deleted

When a workspace is deleted, the system SHALL drain its pending jobs, obliterate the workspace-scoped queues from Redis, close the associated `QueueEvents` connections, and deregister the queues from the `QueueManager` cache and BullBoard — but only when `MODE=queue-dedicated-workspace`.

#### Scenario: Workspace deleted with no active jobs

- **WHEN** `WorkspaceManagementService.deleteWorkspace()` or `deleteWorkspaceById()` is called for workspace `ws-abc123` and `MODE=queue-dedicated-workspace`
- **AND** the workspace has no active (running) jobs in its prediction or upsert queue
- **THEN** `QueueManager.teardownWorkspaceQueue(workspaceId)` SHALL be called after the database transaction commits
- **AND** both workspace queues (`<QUEUE_NAME>-prediction-<workspaceId>` and `<QUEUE_NAME>-upsertion-<workspaceId>`) SHALL be obliterated from Redis
- **AND** their `QueueEvents` connections SHALL be closed
- **AND** both queue instances SHALL be removed from the `QueueManager` internal cache
- **AND** their BullBoard adapter registrations SHALL be removed

#### Scenario: Workspace deleted while jobs are active

- **WHEN** workspace deletion is triggered and one or more jobs are in `active` state in the workspace prediction or upsert queue
- **THEN** the system SHALL log a warning listing the active job IDs
- **AND** obliterate SHALL still proceed with `{ force: true }` (BullMQ semantics: active jobs are abandoned, not waited on)
- **AND** the warning SHALL include guidance to monitor worker logs for any in-flight job failures

#### Scenario: Workspace not in `queue-dedicated-workspace` mode

- **WHEN** `deleteWorkspace()` is called and `MODE` is not `queue-dedicated-workspace`
- **THEN** `teardownWorkspaceQueue` SHALL NOT be called — no queue teardown is performed in legacy `queue` mode

#### Scenario: Workspace has no queue registered (queue never created)

- **WHEN** `QueueManager.teardownWorkspaceQueue(workspaceId)` is called for a workspace that has no queue entry in the cache (e.g., workspace was deleted before any job was ever enqueued)
- **THEN** the system SHALL silently no-op and return without error
