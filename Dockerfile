FROM node:10.12.0-alpine

EXPOSE 3000

RUN \
  apk --no-cache add \
  libc6-compat

COPY package.json .
COPY yarn.lock .

RUN yarn install --prod

COPY build .

CMD ["yarn", "start"]
