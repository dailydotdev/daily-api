<div align="center">
  <h1>Daily API</h1>
  <strong>Legacy service for delivering and managing Daily content👀</strong>
</div>
<br>
<p align="center">
  <a href="https://circleci.com/gh/dailynowco/daily-api">
    <img src="https://img.shields.io/circleci/build/github/dailynowco/daily-api/master.svg" alt="Build Status">
  </a>
  <a href="https://github.com/dailynowco/daily-api/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/dailynowco/daily-api.svg" alt="License">
  </a>
  <a href="https://stackshare.io/daily/daily">
    <img src="http://img.shields.io/badge/tech-stack-0690fa.svg?style=flat" alt="StackShare">
  </a>
</p>

The project started as a monolith service for everything the extension needed (thus Daily API).
Safely and slowly it was tore apart to other services to make every service has only one responsibility.
The so called Daily API kept to itself the content domain. The feed you know very well is delivered from here,
along with other very useful endpoints.

## Technology

* Yarn for managing dependencies.
* Node v10.12.0 (a `.nvmrc` is presented for [nvm](https://github.com/nvm-sh/nvm) users).
* Koa as the web framework

## Project structure

The project was bootstrapped with vue cli so it is very much like any other vue project but just to make sure.
* `helm` - The home of the service helm chart for easily deploying it to kubernetes.
* `migrations` - Knex migrations folder
* `seeds` - Knex database seed files
* `src` - This is obviously the place where you can find the source files.
  * `src/middlewares` - Koa custom middlewares.
  * `src/models` - Modules for interacting with the database.
  * `src/routes` - Endpoints of the server 
  * `src/workers` - Background workers which listens to pub/sub messages.
* `test` - There you can find all the tests and fixtures. Tests are written using `mocha` and `chai`.

## Local environment

Daily API requires a running instance of MySQL, you can easily set it up using docker.
[Check out this guide](https://github.com/dailynowco/daily#setting-up-local-environment) of how to setup Daily services, you need only MySQL (step 2).

When running locally the service, you will also have to set some environment variables:
```bash
export DEFAULT_IMAGE_URL=https://storage.cloud.google.com/devkit-assets/placeholder.jpg
export DEFAULT_IMAGE_PLACEHOLDER="data:image/jpg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4QCYRXhpZgAATU0AKgAAAAgABAEaAAUAAAABAAAAPgEbAAUAAAABAAAARgEoAAMAAAABAAIAAIdpAAQAAAABAAAATgAAAAAAAABIAAAAAQAAAEgAAAABAAWQAAAHAAAABDAyMTCgAAAHAAAABDAxMDCgAQADAAAAAQABAACgAgAEAAAAAQAAAAqgAwAEAAAAAQAAAAYAAAAA/+ECz2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRhLyc+CjxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogPHJkZjpEZXNjcmlwdGlvbiB4bWxuczpleGlmPSdodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyc+CiAgPGV4aWY6WFJlc29sdXRpb24+NzI8L2V4aWY6WFJlc29sdXRpb24+CiAgPGV4aWY6WVJlc29sdXRpb24+NzI8L2V4aWY6WVJlc29sdXRpb24+CiAgPGV4aWY6UmVzb2x1dGlvblVuaXQ+SW5jaDwvZXhpZjpSZXNvbHV0aW9uVW5pdD4KICA8ZXhpZjpFeGlmVmVyc2lvbj5FeGlmIFZlcnNpb24gMi4xPC9leGlmOkV4aWZWZXJzaW9uPgogIDxleGlmOkZsYXNoUGl4VmVyc2lvbj5GbGFzaFBpeCBWZXJzaW9uIDEuMDwvZXhpZjpGbGFzaFBpeFZlcnNpb24+CiAgPGV4aWY6Q29sb3JTcGFjZT5zUkdCPC9leGlmOkNvbG9yU3BhY2U+CiAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjEwMjQ8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogIDxleGlmOlBpeGVsWURpbWVuc2lvbj42MDA8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogPC9yZGY6RGVzY3JpcHRpb24+Cgo8L3JkZjpSREY+CjwveDp4bXBtZXRhPgo8P3hwYWNrZXQgZW5kPSdyJz8+Cv/bAEMAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/bAEMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/CABEIAAYACgMBEQACEQEDEQH/xAAVAAEBAAAAAAAAAAAAAAAAAAAEBv/EABYBAQEBAAAAAAAAAAAAAAAAAAgDBP/aAAwDAQACEAMQAAABuW6Vha4f/8QAFxAAAwEAAAAAAAAAAAAAAAAAAAIDAf/aAAgBAQABBQJHjkz/xAAcEQEBAQACAwEAAAAAAAAAAAACAwEREgAEEyH/2gAIAQMBAT8BFIGNA/W+llu9LbahyZ08fkhxiZeFFNaOm0Ckkp0j5//EABwRAAMBAAIDAAAAAAAAAAAAAAECAwQAExESIf/aAAgBAgEBPwGsdL6JUnsMc6Admdc8nNnD+ft6ezJJplldJoKdgjRLoqWjp5//xAAdEAACAQQDAAAAAAAAAAAAAAABAgMREiEjABMi/9oACAEBAAY/AirQXybKSdrrQNHanhcExSbAThqlHUi0rz//xAAXEAEBAQEAAAAAAAAAAAAAAAABERAx/9oACAEBAAE/IRRs0xVxiFhHGC//2gAMAwEAAgADAAAAEGP/xAAWEQEBAQAAAAAAAAAAAAAAAAABEBH/2gAIAQMBAT8QNAUSVjBHQudd/8QAFhEBAQEAAAAAAAAAAAAAAAAAARAh/9oACAECAQE/EEkCGWNRJa8Ww//EABcQAQADAAAAAAAAAAAAAAAAAAEQESH/2gAIAQEAAT8QpeTsA40GpPBD/9k="
export DEFAULT_IMAGE_RATIO=1.7
export MYSQL_USER=root
export MYSQL_PASSWORD=12345
export MYSQL_DATABASE=devkit

export URL_PREFIX=http://localhost:4000

export PORT=5000

export GATEWAY_SECRET=topsecret
```

If you want some seed data you can run:
`npx knex seed:run`


Finally run `yarn watch` to run the service and listen to port `5000`.

### Caveat

We use `husky` for setting pre-commit git hooks to encrypt helm values.
For those without access to our Google Cloud project it will throw an exception so you can simply comment it out from `package.json`.


## Want to Help?

So you want to contribute to Daily API and make an impact, we are glad to hear it. :heart_eyes:

Before you proceed we have a few guidelines for contribution that will make everything much easier.
We would appreciate if you dedicate the time and read them carefully:
https://github.com/dailynowco/.github/blob/master/CONTRIBUTING.md
