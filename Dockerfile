FROM node:12.14.1-alpine

EXPOSE 3000

RUN \
  apk --no-cache add \
  libc6-compat

COPY package.json .
COPY yarn.lock .

RUN yarn install --prod

COPY build .

CMD ["yarn", "start"]
