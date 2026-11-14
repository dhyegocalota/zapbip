FROM node:24-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@zapbip/api..."

WORKDIR /app/apps/api
ENV ZAPBIP_DATA_DIRECTORY=/data
VOLUME /data
EXPOSE 8787

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
