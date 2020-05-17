FROM node:12.16.2-alpine

COPY package.json .
COPY package-lock.json .

RUN \
  apk --no-cache add \
  libc6-compat

RUN npm i --only=prod

COPY build .

CMD ["npm", "run", "start"]

