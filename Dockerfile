# Build local monorepo image
# docker build --no-cache -t  flowise .

# Run image
# docker run -d -p 3000:3000 flowise

FROM node:20-alpine

# Install system dependencies and build tools
RUN apk update && \
    apk add --no-cache \
        libc6-compat \
        python3 \
        make \
        g++ \
        build-base \
        cairo-dev \
        pango-dev \
        chromium \
        curl \
        git && \
    npm install -g pnpm

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV NODE_OPTIONS=--max-old-space-size=8192

# Build-time argument for Temporal Web UI URL (Vite requires this at build time)
ARG VITE_TEMPORAL_WEB_UI_URL=http://localhost:8080
ENV VITE_TEMPORAL_WEB_UI_URL=$VITE_TEMPORAL_WEB_UI_URL

WORKDIR /usr/src/flowise

# Copy app source
COPY . .

# Install dependencies and build
RUN pnpm install && \
    pnpm build

# Create data directories that the application needs
# These can be overridden by environment variables (DATABASE_PATH, LOG_PATH, BLOB_STORAGE_PATH)
RUN mkdir -p /flowise_data && \
    mkdir -p /flowise_data/logs && \
    mkdir -p /flowise_data/storage && \
    mkdir -p /root/.flowise && \
    mkdir -p /root/.flowise/logs && \
    mkdir -p /root/.flowise/storage

# # Give the node user ownership of the application files and data directories
# RUN chown -R node:node . && \
#     chown -R node:node /flowise_data && \
#     chown -R node:node /root/.flowise

# # Switch to non-root user (node user already exists in node:20-alpine)
# USER node

EXPOSE 3000

CMD [ "pnpm", "start" ]