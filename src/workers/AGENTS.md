# Background Workers

Reactive architecture: non-critical async work (notifications, reputation, external syncs, analytics) is offloaded to Pub/Sub workers instead of blocking requests. Debezium CDC publishes database changes to Pub/Sub, so workers can react to data changes without distributed transactions.

## Rules

- **Only `TypedWorker` (and its variants) is supported** — the legacy `Worker` interface is deprecated. The generic parameter is the topic name from `PubSubSchema` (`src/common/typedPubsub.ts`); the subscription name is a separate string.
- **Topics are managed in the separate "streams" repository** — you cannot create topics here. This repo only adds subscriptions in `.infra/common.ts` (topic, subscription, optional args: `ackDeadlineSeconds`, `deadLetterPolicy`, `enableMessageOrdering`).
- Publish with `triggerTypedEvent` from `src/common/typedPubsub.ts`.
- **Protobuf messages** (from `@dailydotdev/schema`) require a `parseMessage` function on the worker (e.g. `(message) => MyProto.fromBinary(message.data)`) — the linter warns if missing.
- **`ExperimentWorker`**: always call `experimentAllocationClient.waitForSend()` before the handler exits, or allocations silently never reach GrowthBook. Wrap with `workerToExperimentWorker`.
- Re-throw errors from handlers — that triggers nack and redelivery with backoff. Design handlers to be idempotent under redelivery.
- **Deterministic side effects**: when a worker picks between user-facing copy variants (or similar), derive the choice from stable message data, not runtime randomness — retries must produce the same external side effects and tests must not depend on global random state.
- Place handler logic inline in the `handler` function; don't extract a single-use named function it just delegates to.

## Registration (three arrays in `src/workers/index.ts`)

1. `typedWorkers` — standard, runs in the `background` process
2. `personalizedDigestWorkers` — dedicated `personalized-digest` process
3. `workerJobWorkers` — dedicated `worker-job` process (`src/commands/workerJob.ts`), isolating `jobExecuteWorker` for independent scaling and controlled concurrency (`maxMessages: 5` per pod)

A worker registered in the wrong (or no) array never receives messages.

## CDC Workers

Subscribe to `'api.changes'`. Always skip heartbeats and snapshot reads first:

```typescript
if (
  data.schema.name === 'io.debezium.connector.common.Heartbeat' ||
  data.payload.op === 'r'
) {
  return;
}
```

Then switch on `data.payload.source.table`. CDC table capture is configured in `.infra/application.properties`.

## Testing

Tests in `__tests__/workers/` use a real database. Use `expectSuccessfulTypedBackground<'topic-name'>(worker, payload)` and include a "should be registered" test that finds the worker in the appropriate workers array by subscription name.
