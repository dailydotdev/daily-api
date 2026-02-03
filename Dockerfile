# syntax=docker/dockerfile:1
FROM node:22.22-bookworm-slim

ADD https://www.apple.com/appleca/AppleIncRootCertificate.cer /usr/local/share/ca-certificates/AppleIncRootCertificate.cer
ADD https://www.apple.com/certificateauthority/AppleRootCA-G2.cer /usr/local/share/ca-certificates/AppleRootCA-G2.cer
ADD https://www.apple.com/certificateauthority/AppleRootCA-G3.cer /usr/local/share/ca-certificates/AppleRootCA-G3.cer

RUN chmod 644 /usr/local/share/ca-certificates/*.cer && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates dumb-init && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g corepack@0.31.0 && \
    mkdir -p /opt/app && \
    chown -R node:node /opt/app

WORKDIR /opt/app

COPY --chown=node:node .npmrc package.json pnpm-lock.yaml ./
COPY --chown=node:node patches patches
COPY --chown=node:node queries queries
COPY --chown=node:node clickhouse/migrations/*.sql clickhouse/migrations/

USER node

RUN --mount=type=cache,id=pnpm,target=/home/node/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY --chown=node:node build .
COPY --chown=node:node src/routes/public/skill.md src/routes/public/
COPY --chown=node:node src/routes/llm.txt src/routes/

CMD ["dumb-init", "node", "bin/cli", "api"]
