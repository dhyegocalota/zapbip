FROM node:24-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git && rm -rf /var/lib/apt/lists/*
RUN npm install --global openclaw@2026.10.10
COPY plugin.tgz /tmp/plugin.tgz
RUN HOME=/root openclaw plugins install /tmp/plugin.tgz --force --accept-capabilities
