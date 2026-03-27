# Temporal Worker for AgentConsole

This service runs the Temporal Worker that executes Durable Workflows.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AgentConsole   │────▶│    Temporal     │◀────│ Temporal Worker │
│  (Main Server)  │     │  Server:7233    │     │   (This)        │
│  Starts workflow│     │  Queues tasks   │     │  Executes tasks │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Why a Separate Image?

The Temporal Worker uses its own Dockerfile (`node:20-slim`) instead of the main
AgentConsole image (`node:20-alpine`) because:

-   The Temporal SDK's native Rust bridge (`@temporalio/core-bridge`) requires glibc
-   Alpine Linux uses musl libc, which is incompatible with the Temporal SDK
-   Using `node:20-slim` (Debian-based) provides the required glibc support

## Prerequisites

-   Temporal server running (default: port 7233)
-   Temporal Web UI running (default: port 8080)
-   AgentConsole main server running (default: port 3000)

## Quick Start

1. Copy the example environment file:

    ```bash
    cp .env.example .env
    ```

2. Edit `.env` with your configuration (must match main AgentConsole database settings)

3. Build and start the worker:

    ```bash
    # Using docker compose
    docker compose build
    docker compose up -d
    ```

    Or build and start in one command:

    ```bash
    docker compose up -d --build
    ```

## Environment Variables

### Temporal Configuration

| Variable              | Default                          | Description                  |
| --------------------- | -------------------------------- | ---------------------------- |
| `TEMPORAL_ADDRESS`    | `host.containers.internal:7233`  | Temporal server gRPC address |
| `TEMPORAL_NAMESPACE`  | `default`                        | Temporal namespace           |
| `TEMPORAL_TASK_QUEUE` | `agentconsole-durable-workflows` | Task queue to poll           |

### Flowise API

| Variable          | Default                                | Description                                   |
| ----------------- | -------------------------------------- | --------------------------------------------- |
| `FLOWISE_API_URL` | `http://host.containers.internal:3000` | AgentConsole API URL (for calling AgentFlows) |

### Database Configuration

These must match your main AgentConsole instance:

| Variable            | Description                      |
| ------------------- | -------------------------------- |
| `DATABASE_TYPE`     | Database type (e.g., `postgres`) |
| `DATABASE_HOST`     | Database hostname                |
| `DATABASE_PORT`     | Database port                    |
| `DATABASE_NAME`     | Database name                    |
| `DATABASE_USER`     | Database username                |
| `DATABASE_PASSWORD` | Database password                |

## Verify Worker is Running

1. Check the container logs:

    ```bash
    docker compose logs -f temporal-worker
    ```

    You should see:

    ```
    Starting Temporal Worker...
    Temporal Worker started successfully
    Task Queue: agentconsole-durable-workflows
    Namespace: default
    ```

2. Check Temporal Web UI at http://localhost:8080
    - Navigate to the `agentconsole-durable-workflows` task queue
    - The worker should appear in the "Workers" section

## Troubleshooting

### Worker not connecting to Temporal

**Symptoms:** Worker exits with connection error

**Solutions:**

1. Verify Temporal server is running: `docker ps | grep temporal`
2. Check the `TEMPORAL_ADDRESS` is correct
3. If using Podman, ensure `host.containers.internal` resolves correctly

### Worker can't fetch flow definitions

**Symptoms:** Workflow fails with "flow not found" error

**Solutions:**

1. Verify database credentials match main AgentConsole instance
2. Check `DATABASE_HOST` is accessible from the container
3. For Podman, use `host.containers.internal` instead of `localhost`

### AgentFlow calls fail

**Symptoms:** Workflow fails at AgentFlowCall node

**Solutions:**

1. Verify `FLOWISE_API_URL` is correct
2. Ensure AgentConsole main server is running
3. Check that the AgentFlow exists and is accessible

## Logs

View logs in real-time:

```bash
docker compose logs -f temporal-worker
```

View last 100 lines:

```bash
docker compose logs --tail 100 temporal-worker
```
