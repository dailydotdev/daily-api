FROM node:20-bookworm-slim
RUN apt-get update \
    && apt-get install -y ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY .npmrc .
COPY package.json .
COPY package-lock.json .
COPY patches patches
COPY queries queries

RUN npm i --only=prod

COPY build .

RUN chown -R node:node /opt/app
USER node

CMD ["dumb-init", "node", "bin/cli", "api"]

