FROM node:20-bookworm-slim
RUN set -ex \
    && sed -i -- 's/# deb-src/deb-src/g' /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
               build-essential \
               cdbs \
               devscripts \
               equivs \
               fakeroot \
    && apt-get clean \
    && rm -rf /tmp/* /var/tmp/*

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY .npmrc .
COPY package.json .
COPY package-lock.json .

RUN npm i --only=prod

COPY build .

RUN chown -R node:node /opt/app
USER node

CMD ["dumb-init", "node", "bin/cli", "api"]

