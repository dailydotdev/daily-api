# Background Workers Documentation

## Overview

Our architecture follows a **reactive pattern** where we offload non-critical, asynchronous work to background workers. This approach improves API response times, increases system resilience, and enables better scalability.

### Architecture Components

- **Google Pub/Sub**: Message queue for asynchronous event processing
- **Pulumi**: Infrastructure as Code (IaC) for managing subscriptions (located in `.infra/`)
- **Topics**: Managed in a separate infrastructure repository
- **Debezium + CDC**: Change Data Capture for reacting to database changes
- **TypeScript Workers**: Type-safe worker implementations

## When to Use Workers

Use background workers when:

1. **Non-mission-critical processing**: Work that doesn't need to complete before returning a response to the user
2. **Async operations**: Tasks that can happen independently of the main request flow
3. **Third-party integrations**: External API calls (Slack, SendGrid, etc.) that shouldn't block user requests
4. **Heavy computations**: Image processing, data transformations, analytics calculations
5. **Distributed transactions**: When you need to coordinate changes across multiple systems without blocking the primary transaction

### Examples of Worker Use Cases

- Sending notifications (email, push, real-time)
- Updating reputation scores
- Processing images and media
- Syncing data to external services (CIO, Slack)
- Analytics and metrics collection
- Cleanup operations
- Content processing (markdown, translations)

## Worker Types

### Typed Workers (`TypedWorker`)

**Standard approach** for all new workers. Uses the `PubSubSchema` type system to ensure message structure matches expectations and provides full type safety.

```typescript
type TypedWorker<T extends keyof PubSubSchema> = ConditionalTypedWorker<
  T,
  PubSubSchema[T]
>;
```

**Example:**
```typescript
import { TypedWorker } from './worker';

const worker: TypedWorker<'post-upvoted'> = {
  subscription: 'post-upvoted-rep',
  handler: async (message, con, logger): Promise<void> => {
    // message.data is automatically typed as PubSubSchema['post-upvoted']
    const { data, messageId } = message;
    const { postId, userId } = data;
    // Process with full type safety
    logger.info({ postId, userId, messageId }, 'Processing post upvote');
  },
};
```

### Typed Workers with Protobuf

For Protobuf messages (from external services), you need to provide a `parseMessage` function:

```typescript
import { TypedWorker } from './worker';
import { MatchedCandidate } from '@dailydotdev/schema';

const worker: TypedWorker<'gondul.v1.candidate-opportunity-match'> = {
  subscription: 'api.store-candidate-opportunity-match',
  handler: async (message, con): Promise<void> => {
    // message.data is typed as MatchedCandidate
    const { data } = message;
  },
  parseMessage: (message) => {
    return MatchedCandidate.fromBinary(message.data);
  },
};
```

### Typed Notification Workers (`TypedNotificationWorker`)

For notification-specific workers that return `NotificationHandlerReturn`:

```typescript
import { TypedNotificationWorker } from './worker';

const worker: TypedNotificationWorker<'post-upvoted'> = {
  subscription: 'api.article-upvote-milestone-notification',
  handler: async (data, con, logger) => {
    // Returns NotificationHandlerReturn for notification processing
    return { type: NotificationType.ArticleUpvoteMilestone, ... };
  },
};
```

### Experiment Workers (`ExperimentWorker`)

For workers that need access to the GrowthBook experiment allocation client:

```typescript
import { ExperimentWorker, workerToExperimentWorker } from './worker';

const worker: ExperimentWorker = {
  subscription: 'api.experiment-allocated',
  handler: async (message, con, logger, pubsub, experimentAllocationClient) => {
    // experimentAllocationClient available for A/B test tracking
  },
};

// Wrap with workerToExperimentWorker to inject the client
export default workerToExperimentWorker(worker);
```

## Creating a New Worker

### Step 1: Define the Message Schema

If creating a typed worker, add your message type to `src/common/typedPubsub.ts`:

```typescript
export type PubSubSchema = {
  // ... existing schemas
  'my-new-topic': {
    userId: string;
    action: string;
  };
};
```

### Step 2: Create the Worker File

Create a new file in `src/workers/` (or appropriate subdirectory):

```typescript
import { TypedWorker } from './worker';

const worker: TypedWorker<'my-new-topic'> = {
  subscription: 'my-new-subscription',
  handler: async (message, con, logger): Promise<void> => {
    const { data, messageId } = message;
    const { userId, action } = data;
    
    try {
      // Your worker logic here
      logger.info({ userId, action, messageId }, 'Processing worker');
    } catch (err) {
      logger.error({ err, data, messageId }, 'Worker failed');
      throw err; // Re-throw to trigger nack
    }
  },
};

export default worker;
```

### Step 3: Register the Worker

Add your worker to `src/workers/index.ts`. There are three worker arrays:

1. **`typedWorkers`** - TypedWorker instances (preferred for new workers)
2. **`workers`** - Legacy Worker instances (still used for CDC and some older workers)
3. **`personalizedDigestWorkers`** - Separate array for digest workers (run in dedicated process)

```typescript
import myNewWorker from './myNewWorker';

// For TypedWorker instances (recommended)
export const typedWorkers: BaseTypedWorker<any>[] = [
  // ... existing workers
  myNewWorker,
];

// For legacy Worker instances
export const workers: Worker[] = [
  // ... existing workers
];
```

### Step 4: Add Infrastructure Configuration

**Note**: Topics are managed in the "streams" repository. You only need to add the subscription configuration here.

Add the subscription to `.infra/common.ts`:

```typescript
export const workers: Worker[] = [
  // ... existing workers
  {
    topic: 'my-new-topic', // Topic must exist in the "streams" repository
    subscription: 'my-new-subscription',
    args: {
      // Optional: configure ack deadline, dead letter policy, etc.
      ackDeadlineSeconds: 60,
    },
  },
];
```

### Step 5: Publish Messages

Use `triggerTypedEvent` to publish messages (this is the standard approach):

```typescript
import { triggerTypedEvent } from '../common/typedPubsub';

// In your resolver or service:
await triggerTypedEvent(logger, 'my-new-topic', {
  userId: '123',
  action: 'created',
});
```

## Change Data Capture (CDC)

CDC allows us to react to database changes without distributed transactions. Debezium captures PostgreSQL changes and publishes them to Pub/Sub.

### How CDC Works

1. **Debezium** monitors PostgreSQL WAL (Write-Ahead Log)
2. Changes are published to Pub/Sub topics
3. Workers subscribe to CDC topics and react to changes
4. This enables eventual consistency across systems

### CDC Worker Example

```typescript
import { Worker, messageToJson } from './worker';
import { ChangeMessage } from '../types';

const worker: Worker = {
  subscription: 'api-cdc',
  maxMessages: 20, // Process multiple messages at once
  handler: async (message, con, logger): Promise<void> => {
    const data: ChangeMessage<any> = messageToJson(message);
    
    // Skip heartbeat and read operations
    if (
      data.schema.name === 'io.debezium.connector.common.Heartbeat' ||
      data.payload.op === 'r'
    ) {
      return;
    }
    
    // React to specific table changes
    switch (data.payload.source.table) {
      case 'user':
        await handleUserChange(con, logger, data);
        break;
      case 'post':
        await handlePostChange(con, logger, data);
        break;
    }
  },
};
```

### CDC Tables

CDC is configured for specific tables in `.infra/application.properties`. Common patterns:

- React to user changes for external sync (CIO, etc.)
- React to post changes for indexing, notifications
- React to vote changes for reputation calculations
- React to comment changes for notifications

## Worker Execution

### Background Processor

Workers run in the background processor:

```bash
pnpm run dev:background
```

This starts `src/background.ts`, which:
1. Connects to the database
2. Initializes Pub/Sub client
3. Subscribes all registered workers to their subscriptions
4. Processes messages as they arrive

### Message Flow

1. **Publish**: Application code publishes a message to a Pub/Sub topic
2. **Subscribe**: Worker subscribes to the subscription
3. **Receive**: Pub/Sub delivers the message to the worker
4. **Process**: Worker handler executes
5. **Ack/Nack**: Worker acknowledges (ack) on success or negative-acknowledges (nack) on failure
   - **Ack**: Message is removed from subscription
   - **Nack**: Message is redelivered (with exponential backoff)

### Error Handling

Workers should handle errors appropriately:

```typescript
handler: async (message, con, logger): Promise<void> => {
  try {
    // Your logic
  } catch (err) {
    logger.error({ err, messageId: message.messageId }, 'Worker failed');
    throw err; // Re-throw to trigger nack and retry
  }
}
```

**Best Practices:**
- Log errors with context (messageId, data)
- Re-throw errors to trigger retries for transient failures
- Use transactions for database operations
- Consider idempotency (handle duplicate messages gracefully)

## Infrastructure Configuration

### Pulumi Setup

Workers are configured in `.infra/common.ts`. The Pulumi infrastructure:

1. Creates subscriptions (topics are managed in a separate infrastructure repository)
2. Configures subscription settings (ack deadline, dead letter, etc.)
3. Sets up IAM permissions

### Subscription Options

```typescript
interface WorkerArgs {
  enableMessageOrdering?: boolean; // Maintain message order
  ackDeadlineSeconds?: number;     // Time before redelivery
  expirationPolicy?: {
    ttl: string;                    // Subscription TTL
  };
  deadLetterPolicy?: {
    deadLetterTopic: string;       // Topic for failed messages
    maxDeliveryAttempts: number;    // Max retries before dead letter
  };
}
```

### Example: Dead Letter Queue

For critical workers, configure a dead letter queue:

```typescript
// In .infra/common.ts
{
  topic: 'api.v1.generate-personalized-digest',
  subscription: 'api.personalized-digest-email',
  args: {
    ackDeadlineSeconds: 120,
    deadLetterPolicy: {
      deadLetterTopic: `projects/${project}/topics/api.v1.personalized-digest-email-dead-letter`,
      maxDeliveryAttempts: 5,
    },
  },
}
```

## Testing Workers

### Integration Testing

Tests use a real database connection (reset before each test run). Create tests in `__tests__/workers/`:

```typescript
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/myWorker';
import { typedWorkers } from '../../src/workers';
import { YourEntity } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('myWorker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, YourEntity, yourFixtures);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should process messages correctly', async () => {
    await expectSuccessfulTypedBackground(worker, {
      userId: '123',
      action: 'test',
    });
    
    // Verify database state
    const result = await con.getRepository(YourEntity).findOneBy({ ... });
    expect(result).toBeDefined();
  });
});
```

## Best Practices

1. **Use Typed Workers for New Workers**: Use `TypedWorker` for all new workers. The `Worker` interface is still used for CDC workers and some legacy workers.
2. **Use `triggerTypedEvent`**: Always use `triggerTypedEvent` to publish typed messages. Use the helper functions in `src/common/pubsub.ts` for specific event types.
3. **Idempotency**: Design workers to handle duplicate messages gracefully
4. **Logging**: Log with context (messageId, relevant data)
5. **Error Handling**: Re-throw errors to trigger retries, but log appropriately
6. **Monitoring**: Use OpenTelemetry spans (automatically added) for observability
7. **Resource Limits**: Set `maxMessages` appropriately to control concurrency
8. **Dead Letter Queues**: Configure for critical workers to catch persistent failures

## Troubleshooting

### Worker Not Processing Messages

1. Check worker is registered in `src/workers/index.ts`
2. Verify subscription exists in `.infra/common.ts`
3. Ensure background processor is running
4. Check Pub/Sub permissions in GCP

### Messages Stuck in Subscription

1. Check worker logs for errors
2. Verify ack deadline is sufficient
3. Check for dead letter queue messages
4. Review worker error handling

### Type Errors

1. Ensure message type is in `PubSubSchema`
2. Verify `TypedWorker` generic matches topic name
3. Check `parseMessage` for Protobuf messages

## Related Documentation

- **GraphORM**: See `src/graphorm/AGENTS.md` for GraphQL query optimization
- **Main Architecture**: See `AGENTS.md` for high-level architecture overview
- **Pulumi**: See `.infra/` directory for infrastructure configuration

