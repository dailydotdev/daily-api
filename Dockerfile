FROM node:18-alpine
RUN apk add g++ make python3

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY .npmrc .
COPY package.json .
COPY package-lock.json .

RUN \
  apk --no-cache add \
  libc6-compat

RUN npm i --only=prod

COPY build .

RUN chown -R node:node /opt/app
USER node

CMD ["node", "bin/cli", "api"]

