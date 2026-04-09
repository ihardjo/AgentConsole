# Flowise Worker

By utilizing worker instances when operating in queue mode, Flowise can be scaled horizontally by adding more workers to handle increased workloads or scaled down by removing workers when demand decreases.

Here’s an overview of the process:

1. The primary Flowise instance sends an execution ID to a message broker, Redis, which maintains a queue of pending executions, allowing the next available worker to process them.
2. A worker from the pool retrieves a message from Redis.
   The worker starts execute the actual job.
3. Once the execution is completed, the worker alerts the main instance that the execution is finished.

# How to use

## Setting up Main Server:

1. Follow [setup guide](https://github.com/FlowiseAI/Flowise/blob/main/docker/README.md)
2. In the `.env.example`, setup all the necessary env variables for `QUEUE CONFIGURATION`

## Setting up Worker:

1. Navigate to `docker/worker` folder
2. In the `.env.example`, setup all the necessary env variables for `QUEUE CONFIGURATION`. Env variables for worker must match the one for main server. Change the `WORKER_PORT` to other available port numbers to listen for healthcheck. Ex: 5566
3. `docker compose up -d`
4. You can bring the worker container down by `docker compose stop`

## Entrypoint:

Different from main server image which is using `flowise start`, entrypoint for worker is `pnpm run start-worker`. This is because the worker's [Dockerfile](./Dockerfile) build the image from source files via `pnpm build` instead of npm registry via `RUN npm install -g flowise`.

---

## Workspace-Dedicated Mode

In addition to the default shared-queue mode, Flowise supports a **workspace-dedicated** mode where each worker process handles **only one workspace's queues**. This is controlled entirely within a single `MODE=queue` deployment — there is no separate `MODE` value.

### When to use

Use workspace-dedicated workers when you need strict tenant isolation at the queue level — for example, to prevent one busy workspace from starving another, or to meet compliance requirements that prohibit cross-tenant job routing.

### How it works

1. In the **Flowise UI** (Workspace Management), enable **Dedicated Queue** for the target workspace. This sets `workspace.dedicatedQueue = true` in the database.
2. Start a worker with `MODE=queue` and set `WORKER_WORKSPACE_ID=<your-workspace-id>` in the worker's `.env`.
3. The worker creates two workspace-scoped queues:
   - `<QUEUE_NAME>-<workspaceId>-prediction`
   - `<QUEUE_NAME>-<workspaceId>-upsertion`
4. The main server routes all jobs from that workspace to its dedicated queues (instead of the shared global queue).
5. No other workspace's jobs will be processed by this worker.

### Environment variables

| Variable | Description |
|---|---|
| `MODE` | Set to `queue` (same as shared-queue workers) |
| `WORKER_WORKSPACE_ID` | The ID of the workspace this worker is exclusively dedicated to |
| `QUEUE_NAME` | Queue name prefix — must match the main server's `QUEUE_NAME` |

> **Fallback behaviour:** If `WORKER_WORKSPACE_ID` is set but the workspace does not have `dedicatedQueue` enabled in the database, the worker will log a warning and fall back to shared-queue processing.

### Worker auto-exit on workspace deletion

When a workspace is deleted, the main server calls `teardownWorkspaceQueue` which obliterates the workspace's queues from Redis. BullMQ's `Worker` emits a `closing` event when its queue is obliterated. The worker process listens for this event and calls `stopProcess()` automatically — cleanly shutting down without manual intervention.

