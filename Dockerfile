FROM node:12.19-alpine
RUN apk add g++ make python

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY package.json .
COPY package-lock.json .

RUN \
  apk --no-cache add \
  libc6-compat

RUN npm i --only=prod

COPY build .

CMD ["npm", "run", "start"]

