FROM node:22.13-bookworm-slim
RUN apt-get update \
    && apt-get install -y ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY .npmrc .
COPY package.json .
COPY pnpm-lock.yaml .
COPY patches patches
COPY queries queries

RUN npm install -g corepack@0.31.0

RUN pnpm install --frozen-lockfile

COPY build .

RUN chown -R node:node /opt/app
USER node

CMD ["dumb-init", "node", "bin/cli", "api"]

