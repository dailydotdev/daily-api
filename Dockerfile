FROM binxio/gcp-get-secret

FROM node:16-alpine
RUN apk add g++ make python3

RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY --from=0 /gcp-get-secret /usr/local/bin/

COPY package.json .
COPY package-lock.json .

RUN \
  apk --no-cache add \
  libc6-compat

RUN npm i --only=prod

COPY build .

ENTRYPOINT ["/usr/local/bin/gcp-get-secret"]
CMD ["npm", "run", "start"]

