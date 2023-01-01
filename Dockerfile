FROM node:18-slim
RUN apt-get update && apt-get install -y g++ make python3 dumb-init

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

