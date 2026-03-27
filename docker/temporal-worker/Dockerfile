# Temporal Worker Dockerfile
# Uses node:20-slim (Debian-based with glibc) because the Temporal SDK's
# native Rust bridge (@temporalio/core-bridge) requires glibc symbols
# that are not available in Alpine's musl libc.

FROM node:20-slim

# Install required build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /usr/src

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/temporal-worker/package.json ./packages/temporal-worker/

# Install dependencies for temporal-worker only
RUN pnpm install --filter=temporal-worker...

# Copy temporal-worker source code
COPY packages/temporal-worker ./packages/temporal-worker

# Build the temporal-worker
RUN pnpm --filter=temporal-worker build

# Set environment defaults
ENV TEMPORAL_ADDRESS=localhost:7233
ENV TEMPORAL_NAMESPACE=default
ENV TEMPORAL_TASK_QUEUE=agentconsole-durable-workflows
ENV LOG_LEVEL=info

# Run the worker
CMD ["node", "packages/temporal-worker/dist/worker.js"]
