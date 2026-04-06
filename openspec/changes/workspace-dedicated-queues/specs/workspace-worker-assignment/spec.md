## ADDED Requirements

### Requirement: Each worker process SHALL be dedicated to exactly one workspace queue when MODE is `queue-dedicated-workspace`

A worker process SHALL serve exactly one workspace's prediction queue and one workspace's upsert queue when `MODE=queue-dedicated-workspace`. The assigned workspace is determined by the `WORKER_WORKSPACE_ID` environment variable.

#### Scenario: MODE is `queue-dedicated-workspace` and WORKER_WORKSPACE_ID is set

- **WHEN** a worker starts with `MODE=queue-dedicated-workspace` and `WORKER_WORKSPACE_ID` is set to a non-empty workspace ID (e.g., `ws-abc123`)
- **THEN** the worker SHALL call `setupWorkspaceQueue(workspaceId)` and create exactly one BullMQ `Worker` for `<QUEUE_NAME>-prediction-<workspaceId>` and one for `<QUEUE_NAME>-upsertion-<workspaceId>`

#### Scenario: MODE is `queue` (legacy fallback)

- **WHEN** a worker starts with `MODE=queue` (or MODE is absent/unrecognised)
- **THEN** the worker SHALL fall back to calling `setupAllQueues()` and creating workers for the legacy global `prediction` and `upsert` queues, preserving all existing shared-queue behaviour unchanged

#### Scenario: MODE is `queue-dedicated-workspace` but WORKER_WORKSPACE_ID is not set

- **WHEN** a worker starts with `MODE=queue-dedicated-workspace` and `WORKER_WORKSPACE_ID` is absent or empty
- **THEN** the worker SHALL log a warning and fall back to the legacy shared-queue path to prevent a broken worker process

### Requirement: Abort events SHALL be propagated for the assigned workspace prediction queue

The worker SHALL attach a `QueueEvents` listener that propagates `abort` events to the `AbortControllerPool` for its assigned workspace prediction queue.

#### Scenario: Abort event received on the workspace prediction queue

- **WHEN** an `abort` event is emitted on the `QueueEvents` for the worker's assigned workspace prediction queue
- **THEN** `abortControllerPool.abort(id)` SHALL be called with the aborted job's ID

### Requirement: Worker shutdown SHALL close all BullMQ worker instances and event listeners gracefully

When a worker process receives a shutdown signal, it SHALL close its prediction and upsert BullMQ Worker instances **and** the `QueueEvents` listener before exiting to prevent Redis connection leaks.

#### Scenario: Worker process receives SIGTERM

- **WHEN** the worker process is sent SIGTERM
- **THEN** both the prediction and upsert BullMQ Worker instances SHALL be closed gracefully, and the `QueueEvents` listener for the workspace prediction queue SHALL be closed, before the process exits

### Requirement: Workers SHALL log their assigned workspace at startup

When a worker process starts in workspace mode, the system SHALL emit an info-level log identifying the workspace and the worker IDs.

#### Scenario: Worker starts with WORKER_WORKSPACE_ID configured

- **WHEN** the worker process initialises BullMQ workers for its assigned workspace
- **THEN** the system SHALL emit an info-level log entry per worker in the format `[Worker] Prediction Worker <workerId> serving workspace <workspaceId>`

### Requirement: Workers SHALL exit gracefully when their assigned workspace queue is obliterated

When a workspace is deleted and its BullMQ queues are obliterated on the server side, the worker process assigned to that workspace SHALL detect the queue removal and shut itself down cleanly.

#### Scenario: Worker detects its queue has been obliterated

- **WHEN** the BullMQ `Worker` instance emits a `closing` or `closed` event as a result of the server calling `queue.obliterate()` on the workspace's queue
- **THEN** the worker process SHALL log an info-level message: `[Worker] Workspace <workspaceId> queue has been removed — shutting down worker`
- **AND** the worker SHALL call `stopProcess()` to close all BullMQ Worker instances and the `QueueEvents` listener before the process exits

#### Scenario: Worker cannot connect to its assigned queue after obliteration

- **WHEN** a worker process starts and `WORKER_WORKSPACE_ID` is set but the corresponding queue no longer exists in Redis (was obliterated while the worker was offline)
- **THEN** the worker SHALL log a warning: `[Worker] Queue for workspace <workspaceId> not found in Redis — no pending jobs to process`
- **AND** the worker SHALL continue running normally (the queue will be re-created in Redis the next time a job is enqueued for that workspace)
