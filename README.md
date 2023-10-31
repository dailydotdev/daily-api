<div align="center">
  <h1>Daily API V2</h1>
  <strong>Provide the daily.dev feed and engagement layer</strong>
</div>
<br>
<p align="center">
  <a href="https://circleci.com/gh/dailydotdev/daily-api">
    <img src="https://img.shields.io/circleci/build/github/dailydotdev/daily-api/master.svg" alt="Build Status">
  </a>
  <a href="https://github.com/dailydotdev/daily-api/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/dailydotdev/daily-api.svg" alt="License">
  </a>
  <a href="https://stackshare.io/daily/daily">
    <img src="http://img.shields.io/badge/tech-stack-0690fa.svg?style=flat" alt="StackShare">
  </a>
</p>

The project started as a monolith service for everything the extension needed (thus Daily API).
Safely and slowly it was torn apart to other services to make every service have only one responsibility.
The so called Daily API kept to itself the content domain. The feed you know very well is delivered from here,
along with other very useful endpoints.

## Stack

- Node v18 (a `.nvmrc` is presented for [nvm](https://github.com/nvm-sh/nvm) users).
- NPM for managing dependencies.
- Fastify as the web framework
- Apollo for GraphQL
- Typeorm as a database layer

## Project structure

- `__tests__` - There you can find all the tests and fixtures. Tests are written using `jest`.
- `bin` - Folder with utilities and executables.
- `helm` - The home of the service helm chart for easily deploying it to kubernetes.
- `seeds` - JSON files with seed data for local development.
- `src` - This is obviously the place where you can find the source files.
  - `common` - Utility functions that are used across the project.
  - `compatibility` - Fastify routes to keep backwards compatibility with API v1.
  - `cron` - Tasks that will be deployed as cron jobs.
  - `directive` - GraphQL schema directives.
  - `entity` - Typeorm entities that are used to communicate with the database and sync its schema.
  - `migration` - Typeorm migrations folder to update the database schema.
  - `schema` - Apollo GraphQL resolvers, including also types.
  - `workers` - Pub/Sub message handlers that are deployed as part of the background processor.

## Local environment

Daily API requires a running instance of PostgreSQL, you can easily set it up using the provided [`docker-compose`](docker-compose.yml) file.
[Check out this guide](https://docs.docker.com/compose/install/) of how to install Docker Compose. Once installed, you can run `docker-compose up -d` and viola!

Make sure to apply the latest migrations by running:
`npm run db:migrate:latest`

[.env](.env) is used to set the required environment variables. It is loaded automatically by the project.

If you want some seed data you can run:
`npm run db:seed:import`

Finally run `npm run dev` to run the service and listen to port `5000`.

### Caveat

Currently, there is no staging environment for Algolia so there is no search functionality for local development.

## GraphORM

We have an internal solution to tackle problems we have encountered along the way.
The library is in its early stages so we are continually writing the documentation to provide better developer experience. Have a look at the link below:
https://github.com/dailydotdev/daily-api/wiki/GraphORM

## Want to Help?

So you want to contribute to Daily API and make an impact, we are glad to hear it. :heart_eyes:

Before you proceed we have a few guidelines for contribution that will make everything much easier.
We would appreciate if you dedicate the time and read them carefully:
https://github.com/dailydotdev/.github/blob/master/CONTRIBUTING.md
