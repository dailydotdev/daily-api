FROM node:11.6.0-alpine

EXPOSE 3000

COPY package.json .
COPY yarn.lock .

RUN \
  apk --no-cache add \
  libc6-compat

RUN yarn install --prod

COPY build .

CMD ["yarn", "start"]
