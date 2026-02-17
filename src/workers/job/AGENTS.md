# WorkerJob System

Async job execution system with persistent state, RPC endpoints, and parent-child batch support.

## How It Works

1. Client calls a **Start RPC** → creates a `WorkerJob` entity → publishes to PubSub
2. `jobExecuteWorker` picks up the message → dispatches to a type handler → saves result
3. Client polls **GetJobStatus** or **GetBatchStatus** RPC to check progress
4. Client calls a **GetResult RPC** to retrieve the output

## Key Files

| File | Purpose |
|------|---------|
| `src/entity/WorkerJob.ts` | Entity with type, status, input, result, error, parentId |
| `src/workers/job/jobExecute.ts` | PubSub worker — dispatches to handlers, manages lifecycle |
| `src/routes/private/workerJobRpc.ts` | GetJobStatus + GetBatchStatus RPCs (shared) |
| `src/commands/workerJob.ts` | Dedicated K8s process (`pnpm run dev:worker-job`) |

## Enums (from `@dailydotdev/schema`)

- **`WorkerJobType`** — job types (FIND_JOB_VACANCIES, FIND_COMPANY_NEWS, FIND_CONTACT_ACTIVITY)
- **`WorkerJobStatus`** — PENDING → RUNNING → COMPLETED/FAILED

Entity stores these as `integer` columns, not TypeScript enums.

## Parent-Child Batch Model

A parent job (status RUNNING, no input) has N child jobs (each with their own input). Children execute in parallel via PubSub. When the last child completes or fails, the `finally` block in `jobExecuteWorker` calls `checkParentCompletion` which marks the parent COMPLETED (all succeeded) or FAILED (any failed).

Client tracks one parent `jobId`, polls `GetBatchStatus` for aggregate counts.

## Adding a New Job Type

1. **Schema repo**: Add enum value to `WorkerJobType`, define Start/GetResult request/response messages, add RPCs to `WorkerJobService`
2. **Handler file**: Create `src/workers/job/yourHandler.ts` exporting a function matching `JobHandlerParams => Promise<Record<string, unknown>>`
3. **Register handler**: Add a `case` in `getJobHandler()` switch in `jobExecute.ts`
4. **RPC endpoints**: Add Start + GetResult handlers (follow existing patterns in route files)

### Handler template

```typescript
import type { JobHandlerParams } from './jobExecute';

export const handleSomething = async ({ input, con }: JobHandlerParams): Promise<Record<string, unknown>> => {
  const result = await doWork(input);
  return result.toJson() as Record<string, unknown>;
};
```

### Batch Start RPC pattern

```typescript
const parent = await repo.save(repo.create({
  type: WorkerJobType.YOUR_TYPE,
  status: WorkerJobStatus.RUNNING,
  input: null,
}));

const children = req.items.map((item) =>
  repo.create({
    type: WorkerJobType.YOUR_TYPE,
    status: WorkerJobStatus.PENDING,
    parentId: parent.id,
    input: item.toJson() as Record<string, unknown>,
  }),
);
const saved = await repo.save(children);

await Promise.all(
  saved.map((child) => triggerTypedEvent(logger, 'api.v1.worker-job-execute', { jobId: child.id })),
);

return new StartWorkerJobResponse({ jobId: parent.id });
```

## Testing

- **Worker tests**: `__tests__/workers/job/jobExecute.ts` — uses `expectSuccessfulTypedBackground<'api.v1.worker-job-execute'>`
- **RPC tests**: `__tests__/routes/private/workerJobRpc.ts` — uses `createClient(WorkerJobService, mockTransport)` with service auth interceptor
