# WorkerJob System

Async job execution: a Start RPC creates a `WorkerJob` entity and publishes to PubSub; `jobExecuteWorker` dispatches to a type handler and saves the result; clients poll GetJobStatus/GetBatchStatus and fetch output via a GetResult RPC.

## Key Files

| File | Purpose |
|------|---------|
| `src/entity/WorkerJob.ts` | Entity with type, status, input, result, error, parentId |
| `src/workers/job/jobExecute.ts` | PubSub worker — dispatches to handlers, manages lifecycle |
| `src/routes/private/workerJobRpc.ts` | GetJobStatus + GetBatchStatus RPCs (shared) |
| `src/commands/workerJob.ts` | Dedicated K8s process (`pnpm run dev:worker-job`) |

## Non-Obvious Details

- `WorkerJobType` / `WorkerJobStatus` come from `@dailydotdev/schema`; the entity stores them as `integer` columns, not TypeScript enums.
- **Parent-child batches**: a parent job (status RUNNING, `input: null`) has N children executing in parallel. Parent completion is not event-driven from the client side — the `finally` block in `jobExecuteWorker` calls `checkParentCompletion` after each child, marking the parent COMPLETED (all succeeded) or FAILED (any failed). Clients track only the parent `jobId`.
- **Adding a new job type requires a schema-repo change first**: add the enum value + Start/GetResult messages + RPCs to `WorkerJobService` in `@dailydotdev/schema`, then create a handler in `src/workers/job/` and register it in the `getJobHandler()` switch in `jobExecute.ts`. Follow existing handlers/RPCs for the patterns.

## Testing

- Worker: `__tests__/workers/job/jobExecute.ts` — `expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>`
- RPC: `__tests__/routes/private/workerJobRpc.ts` — `createClient(WorkerJobService, mockTransport)` with service auth interceptor
