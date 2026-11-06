FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git && rm -rf /var/lib/apt/lists/*
RUN npm install --global openclaw@2026.10.10
COPY plugin.tgz /tmp/plugin.tgz
RUN HOME=/root openclaw plugins install /tmp/plugin.tgz --force --accept-capabilities
