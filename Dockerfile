FROM node:22.16-bookworm-slim

ADD https://www.apple.com/appleca/AppleIncRootCertificate.cer /usr/local/share/ca-certificates/AppleIncRootCertificate.cer
ADD https://www.apple.com/certificateauthority/AppleRootCA-G2.cer /usr/local/share/ca-certificates/AppleRootCA-G2.cer
ADD https://www.apple.com/certificateauthority/AppleRootCA-G3.cer /usr/local/share/ca-certificates/AppleRootCA-G3.cer

RUN chmod 644 /usr/local/share/ca-certificates/AppleIncRootCertificate.cer && \
    chmod 644 /usr/local/share/ca-certificates/AppleRootCA-G2.cer && \
    chmod 644 /usr/local/share/ca-certificates/AppleRootCA-G3.cer

RUN apt-get update \
    && apt-get install -y ca-certificates dumb-init \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/app
WORKDIR /opt/app

RUN npm install -g corepack@0.31.0

COPY .npmrc .
COPY package.json .
COPY pnpm-lock.yaml .
COPY patches patches
COPY queries queries
COPY clickhouse/migrations/*.sql clickhouse/migrations/

RUN pnpm install --frozen-lockfile

COPY build .

RUN chown -R node:node /opt/app
USER node

CMD ["dumb-init", "node", "bin/cli", "api"]

