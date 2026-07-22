# Cron Jobs

One file per cron in `src/cron/`, exporting a `Cron` object (`name` + `handler(con, logger, pubsub)`). Registered in `src/cron/index.ts`, deployed as Kubernetes CronJobs via `.infra/crons.ts` (schedule, resource limits, `activeDeadlineSeconds`). Run locally: `pnpm run cli cron <name>`.

## Gotchas

- **The cron name must match exactly in three places** or it silently won't run: the `name` property in the cron file, the registration in `src/cron/index.ts`, and the entry in `.infra/crons.ts`. Check all three first when a cron isn't running.
- Deployment defaults (from `.infra/index.ts`): spot instances enabled, background-worker limits (`512Mi` memory) unless overridden, 300s `activeDeadlineSeconds` unless overridden, and **crons are disabled in adhoc environments**.

## Lessons

- Let errors propagate so Kubernetes marks the job failed — don't swallow them.
- Make crons rerunnable and idempotent. For materialization/backfill jobs, use deterministic unique keys and atomic per-scope writes so a retry after a mid-run failure continues safely without duplicating or half-writing rows.
- When processing many independent scopes/periods, prefer atomic per-scope writes over one giant transaction — retries stay cheap while each scope stays consistent.
- Use checkpoints for incremental processing (see `updateViews.ts`) and batch large datasets to avoid OOM.

## Testing

Tests live in `__tests__/cron/` and use a real database. Use `expectSuccessfulCron(cronObject)` from `__tests__/helpers` plus fixtures, then assert database state.
