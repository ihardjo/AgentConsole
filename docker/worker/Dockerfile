FROM node:20-alpine

RUN apk add --update libc6-compat python3 make g++
# needed for pdfjs-dist
RUN apk add --no-cache build-base cairo-dev pango-dev

# Install Chromium and curl for container-level health checks
RUN apk add --no-cache chromium curl

#install PNPM globally
RUN npm install -g pnpm

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV NODE_OPTIONS=--max-old-space-size=8192

WORKDIR /usr/src

# Copy app source
COPY . .

RUN pnpm install

RUN pnpm build

# Create data directories that the application needs
# These can be overridden by environment variables (DATABASE_PATH, LOG_PATH, BLOB_STORAGE_PATH)
RUN mkdir -p /flowise_data && \
    mkdir -p /flowise_data/logs && \
    mkdir -p /flowise_data/storage && \
    mkdir -p /root/.flowise && \
    mkdir -p /root/.flowise/logs && \
    mkdir -p /root/.flowise/storage

# --- Healthcheck Setup ---

WORKDIR /app/healthcheck

COPY docker/worker/healthcheck/package.json . 

RUN npm install --omit=dev

COPY docker/worker/healthcheck/healthcheck.js .

# --- End Healthcheck Setup ---

# Set the main working directory back
WORKDIR /usr/src

# Environment variables for port configuration
ENV WORKER_PORT=5566

# Expose port (can be overridden by env var)
EXPOSE ${WORKER_PORT}

# Start healthcheck in background and flowise worker in foreground
CMD ["/bin/sh", "-c", "node /app/healthcheck/healthcheck.js & sleep 5 && pnpm run start-worker"]
