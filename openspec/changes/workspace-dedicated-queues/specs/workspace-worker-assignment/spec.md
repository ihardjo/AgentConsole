## ADDED Requirements

### Requirement: Each worker process SHALL serve either the shared queue or one workspace-dedicated queue, determined by `WORKER_WORKSPACE_ID` within `MODE=queue`

A worker process operates in one of two paths within a single `MODE=queue` deployment. The path is determined exclusively by the presence of the `WORKER_WORKSPACE_ID` environment variable — not by a distinct MODE value. There is no separate `queue-dedicated-workspace` MODE.

#### Scenario: MODE is `queue` and WORKER_WORKSPACE_ID is set

- **WHEN** a worker starts with `MODE=queue` and `WORKER_WORKSPACE_ID` is set to a non-empty workspace ID (e.g., `ws-abc123`)
- **THEN** the worker SHALL call `setupWorkspaceQueue(workspaceId)` and create exactly one BullMQ `Worker` for `<QUEUE_NAME>-<workspaceId>-prediction` and one for `<QUEUE_NAME>-<workspaceId>-upsertion`

#### Scenario: MODE is `queue` and WORKER_WORKSPACE_ID is not set

- **WHEN** a worker starts with `MODE=queue` and `WORKER_WORKSPACE_ID` is absent or empty
- **THEN** the worker SHALL call `setupAllQueues()` and create workers for the global shared `prediction` and `upsert` queues, preserving all existing shared-queue behaviour unchanged

#### Scenario: WORKER_WORKSPACE_ID is set — no database check of `dedicatedQueue`

- **WHEN** a worker starts with `MODE=queue` and `WORKER_WORKSPACE_ID` is set
- **THEN** the worker SHALL proceed with `setupWorkspaceQueue(workspaceId)` regardless of the workspace's `dedicatedQueue` database value
- **AND** the worker does NOT perform a database lookup to verify `dedicatedQueue=true`; it is the operator's responsibility to ensure the workspace toggle is enabled before starting a dedicated worker

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

When a worker process starts in workspace-dedicated path, the system SHALL emit an info-level log identifying the workspace and the worker IDs.

#### Scenario: Worker starts with WORKER_WORKSPACE_ID configured

- **WHEN** the worker process initialises BullMQ workers for its assigned workspace
- **THEN** the system SHALL emit a log: `[Worker] MODE=queue + WORKER_WORKSPACE_ID — workspace: <workspaceId>`
- **AND** per-worker logs SHALL be emitted in the format `Prediction Worker <workerId> created for workspace <workspaceId>` and `Upsertion Worker <workerId> created for workspace <workspaceId>`

### Requirement: Workers SHALL exit gracefully when their assigned workspace queue is obliterated

When a workspace is deleted and its BullMQ queues are obliterated on the server side, the worker process assigned to that workspace SHALL detect the queue removal and shut itself down cleanly.

#### Scenario: Worker detects its prediction queue is closing

- **WHEN** the BullMQ `Worker` instance emits a `closing` event (as a result of the server calling `queue.obliterate()` on the workspace's queue)
- **THEN** the worker process SHALL log: `[Worker] Prediction worker for workspace <workspaceId> is closing — initiating graceful shutdown`
- **AND** the worker SHALL call `stopProcess()` to close both BullMQ Worker instances and the `QueueEvents` listener before the process exits

#### Scenario: Worker detects its upsertion queue is closing

- **WHEN** the BullMQ `Worker` instance for the upsert queue emits a `closing` event
- **THEN** the worker process SHALL log: `[Worker] Upsertion worker for workspace <workspaceId> is closing — initiating graceful shutdown`
- **AND** the worker SHALL call `stopProcess()`

#### Scenario: Worker cannot connect to its assigned queue after obliteration

- **WHEN** a worker process starts and `WORKER_WORKSPACE_ID` is set but the corresponding queue no longer exists in Redis (was obliterated while the worker was offline)
- **THEN** the worker SHALL continue running normally — the queue will be re-created in Redis the next time a job is enqueued for that workspace by the server
