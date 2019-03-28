FROM node:11.6.0-alpine

EXPOSE 3000

RUN apk add --no-cache libstdc++ \
 && apk add --no-cache --update git make g++ unzip autoconf automake libtool file openssl curl python

COPY package.json .
COPY yarn.lock .

RUN yarn install --prod

COPY build .

CMD ["yarn", "start"]
