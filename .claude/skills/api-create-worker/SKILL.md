---
name: api-create-worker
description: Create a new background worker in daily-api with full type safety, infrastructure config, and tests
argument-hint: "[worker name and purpose]"
---

# Create a New daily-api Worker

You are creating a new background worker for daily-api. Follow this skill step by step.

## Context Loading

Before writing any code, read these files for code style rules and worker conventions:

1. `AGENTS.md` (project root) — code style, architecture, best practices
2. `src/workers/AGENTS.md` — worker-specific patterns, types, and conventions

These are the source of truth for all code style decisions. Do not deviate from them.

## Step 0 — Gather Requirements

Before writing any code, ask the user the following questions **in this order**:

### 1. Worker type

> **TypedWorker** (standard) or **TypedNotificationWorker**?

- `TypedWorker` — standard worker with `handler(message, con, logger)` returning `Promise<void>`
- `TypedNotificationWorker` — notification worker with `handler(data, con, logger)` returning `NotificationHandlerReturn`

This determines the handler signature, return type, registration target, and file template.

### 2. PubSub topic name

> **What topic does this worker subscribe to?**

This determines the subscription config and schema lookup.

### 3. Message type

> **What is the message type?** One of:
>
> - **(a)** Existing Protobuf type from `@dailydotdev/schema`
> - **(b)** Existing type already in `PubSubSchema` (check `src/common/typedPubsub.ts`)
> - **(c)** New type — describe the fields

This determines whether to add a schema entry, wire up `parseMessage`, or reference an existing type.

### 4. Business logic

> **What should the worker do when it receives a message?**

Core implementation details.

---

## Step 1 — Define/Confirm Message Schema

Based on the message type answer from Step 0:

### (a) Protobuf from `@dailydotdev/schema`

Import the type and add an entry to `PubSubSchema` in `src/common/typedPubsub.ts` mapping the topic to the imported Protobuf type. The worker will need a `parseMessage` function using `.fromBinary()`.

Reference: `src/workers/opportunity/storeCandidateOpportunityMatch.ts` — uses `MatchedCandidate.fromBinary(message.data)`.

### (b) Already in `PubSubSchema`

Skip this step — just reference the existing topic key in the worker's generic parameter.

### (c) New type

Add a new entry to `PubSubSchema` in `src/common/typedPubsub.ts`:

```typescript
export type PubSubSchema = {
  // ... existing entries
  'your-topic-name': {
    field1: string;
    field2: number;
  };
};
```

---

## Step 2 — Create the Worker File

Create the worker file at `src/workers/[name].ts` (or `src/workers/[domain]/[name].ts` for domain-specific workers).

### TypedWorker template

Reference example: `src/workers/feedbackClassify.ts` (standard), `src/workers/opportunity/storeCandidateOpportunityMatch.ts` (Protobuf with `parseMessage`).

```typescript
import { TypedWorker } from './worker';

const worker: TypedWorker<'topic-name'> = {
  subscription: 'subscription-name',
  handler: async (message, con, logger): Promise<void> => {
    const { data, messageId } = message;
    // Business logic here
  },
};

export default worker;
```

If using Protobuf, add `parseMessage`:

```typescript
import { TypedWorker } from './worker';
import { YourProtoType } from '@dailydotdev/schema';

const worker: TypedWorker<'topic-name'> = {
  subscription: 'subscription-name',
  handler: async (message, con, logger): Promise<void> => {
    const { data, messageId } = message;
    // data is typed as YourProtoType
  },
  parseMessage: (message) => {
    return YourProtoType.fromBinary(message.data);
  },
};

export default worker;
```

### TypedNotificationWorker template

Reference example: `src/workers/notifications/achievementUnlockedNotification.ts`.

```typescript
import { TypedNotificationWorker } from '../worker';

const worker: TypedNotificationWorker<'topic-name'> = {
  subscription: 'subscription-name',
  handler: async (data, con, logger) => {
    // data is already parsed (no message wrapper)
    // Return NotificationHandlerReturn
  },
};

export default worker;
```

---

## Step 3 — Register the Worker

Registration depends on worker type:

| Worker Type | Registration File | Array |
|---|---|---|
| `TypedWorker` | `src/workers/index.ts` | `typedWorkers` |
| `TypedNotificationWorker` | `src/workers/notifications/index.ts` | `notificationWorkers` |

### TypedWorker registration

Add import and entry to the `typedWorkers` array in `src/workers/index.ts`:

```typescript
import myNewWorker from './myNewWorker';

export const typedWorkers: BaseTypedWorker<any>[] = [
  // ... existing workers
  myNewWorker,
];
```

### TypedNotificationWorker registration

Add import and entry to the `notificationWorkers` array in `src/workers/notifications/index.ts`. These are automatically wrapped via `notificationWorkerToWorker` and spread into the main `workers` array.

```typescript
import myNotificationWorker from './myNotificationWorker';

const notificationWorkers = [
  // ... existing workers
  myNotificationWorker,
];
```

---

## Step 4 — Add Infrastructure Config

Add a subscription entry to the `workers` array in `.infra/common.ts`:

```typescript
{
  topic: 'topic-name',
  subscription: 'subscription-name',
  args: { /* optional: ackDeadlineSeconds, deadLetterPolicy */ },
},
```

**Note:** Topics are managed in the separate "streams" repository. This step only adds the subscription.

---

## Step 5 — Write Tests

Create an integration test at `__tests__/workers/[name].ts`.

Reference: `__tests__/workers/feedbackClassify.ts` for a complete TypedWorker test example.

Follow this pattern:

```typescript
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/myWorker';
import { typedWorkers } from '../../src/workers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('myWorker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    // Set up test fixtures
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should process messages correctly', async () => {
    await expectSuccessfulTypedBackground<'topic-name'>(worker, {
      // message data matching PubSubSchema['topic-name']
    });

    // Verify database state after processing
  });

  // Add edge case tests: not found, already processed, etc.
});
```

For `TypedNotificationWorker`, check registration in the `workers` array (which includes wrapped notification workers) instead of `typedWorkers`.

Use `expectSuccessfulTypedBackground` with the topic name as generic type parameter for full type safety.

---

## File Locations Quick Reference

| Purpose | Path |
|---|---|
| PubSub schema types | `src/common/typedPubsub.ts` |
| Worker file | `src/workers/[name].ts` |
| Worker registration (typed) | `src/workers/index.ts` → `typedWorkers` |
| Worker registration (notification) | `src/workers/notifications/index.ts` → `notificationWorkers` |
| Infra subscription config | `.infra/common.ts` → `workers` |
| Test file | `__tests__/workers/[name].ts` |
| Code style reference | `AGENTS.md`, `src/workers/AGENTS.md` |

## Instructions

When the user invokes this skill:

1. Read `AGENTS.md` and `src/workers/AGENTS.md` for context
2. Complete Step 0 — ask all four questions before writing any code
3. Work through Steps 1–5 in order, confirming each step with the user
4. Reference the actual codebase examples listed above rather than relying solely on the templates
5. Follow all code style rules from the AGENTS.md files
