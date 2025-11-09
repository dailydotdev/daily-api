# Cron Jobs Guide

This document describes the cron job architecture and how to work with scheduled tasks in this codebase.

## Overview

Cron jobs are scheduled tasks that run at specific intervals to perform maintenance, data processing, and automated workflows. The architecture follows a simple pattern: **one file per cron job**, with all crons registered in a central index file and deployed via Pulumi infrastructure configuration.

## Architecture

### File Structure

```
src/cron/
├── index.ts              # Central registry of all cron jobs
├── cron.ts               # Cron interface definition
├── updateViews.ts        # Example: individual cron file
├── personalizedDigest.ts # Example: individual cron file
└── ...                   # Other cron files
```

### Key Components

1. **Individual Cron Files** (`src/cron/*.ts`)
   - Each cron job is a separate TypeScript file
   - Exports a `Cron` object with `name` and `handler` function
   - Handler receives: `DataSource` (TypeORM), `FastifyLoggerInstance`, and `PubSub`

2. **Cron Registry** (`src/cron/index.ts`)
   - Imports all individual cron files
   - Exports a `crons` array containing all `Cron` objects
   - Used by the execution entry point to find and run crons

3. **Execution Entry Point** (`src/cron.ts`)
   - Accepts a cron name as parameter
   - Finds the matching cron from the registry
   - Executes the handler with database connection, logger, and PubSub

4. **Infrastructure Configuration** (`.infra/crons.ts`)
   - Defines deployment configuration for each cron
   - Specifies schedule (cron expression), resource limits, and requests
   - Used by Pulumi to create Kubernetes CronJobs

5. **Pulumi Deployment** (`.infra/index.ts`)
   - Reads the crons array from `.infra/crons.ts`
   - Creates Kubernetes CronJob resources for each cron
   - Maps cron names to execution commands: `['dumb-init', 'node', 'bin/cli', 'cron', cron.name]`

## Creating a New Cron Job

### Step 1: Create the Cron File

Create a new file in `src/cron/` directory following this pattern:

```typescript
import { Cron } from './cron';
import { YourEntity } from '../entity';

const cron: Cron = {
  name: 'your-cron-name', // Must match name in .infra/crons.ts
  handler: async (con, logger, pubsub) => {
    // Your cron logic here
    logger.info('Starting cron job');
    
    // Example: Query database
    const results = await con
      .getRepository(YourEntity)
      .find();
    
    // Example: Publish Pub/Sub messages
    await pubsub.topic('your-topic').publishMessage({
      json: { data: 'value' },
    });
    
    logger.info({ count: results.length }, 'Cron job completed');
  },
};

export default cron;
```

### Step 2: Register in Index

Add your cron to `src/cron/index.ts`:

```typescript
import yourCron from './yourCron';

export const crons: Cron[] = [
  // ... existing crons
  yourCron,
];
```

### Step 3: Configure Infrastructure

Add your cron to `.infra/crons.ts`:

```typescript
export const crons: Cron[] = [
  // ... existing crons
  {
    name: 'your-cron-name', // Must match name in cron file
    schedule: '0 */1 * * *', // Cron expression (every hour)
    // Optional: Resource limits for memory-intensive jobs
    limits: {
      memory: '1Gi',
    },
    requests: {
      cpu: '250m',
      memory: '1Gi',
    },
    // Optional: Maximum execution time in seconds
    activeDeadlineSeconds: 300,
  },
];
```

### Step 4: Test Locally

Run the cron locally using the CLI:

```bash
pnpm run cli cron your-cron-name
```

Or directly:

```bash
node bin/cli cron your-cron-name
```

## Cron Interface

The `Cron` interface is defined in `src/cron/cron.ts`:

```typescript
export interface Cron {
  name: string;
  handler: (
    con: DataSource,
    logger: FastifyLoggerInstance,
    pubsub: PubSub,
  ) => Promise<void>;
}
```

### Handler Parameters

- **`con: DataSource`** - TypeORM database connection. Use for queries, transactions, and entity operations.
- **`logger: FastifyLoggerInstance`** - Structured logger for observability. Always log start, progress, and completion.
- **`pubsub: PubSub`** - Google Cloud Pub/Sub client. Use to publish messages for async processing.

## Best Practices

### 1. Naming Convention

- Use kebab-case for cron names (e.g., `update-views`, `clean-zombie-users`)
- Names must match exactly between:
  - The cron file (`name` property)
  - The index registration (import name)
  - The infrastructure config (`.infra/crons.ts`)

### 2. Logging

Always log important events:

```typescript
handler: async (con, logger, pubsub) => {
  logger.info({ cron: 'your-cron-name' }, 'Starting cron job');
  
  try {
    // Your logic
    logger.info({ processed: count }, 'Cron job completed successfully');
  } catch (error) {
    logger.error({ error }, 'Cron job failed');
    throw error; // Re-throw to mark job as failed
  }
}
```

### 3. Error Handling

- Let errors propagate to mark the cron job as failed in Kubernetes
- Use transactions for data consistency
- Consider idempotency for retry safety

### 4. Resource Management

- Use checkpoints for incremental processing (see `updateViews.ts` example)
- Process data in batches to avoid memory issues
- Set appropriate resource limits in `.infra/crons.ts` for memory-intensive jobs

### 5. Scheduling

- Use standard cron expressions: `minute hour day month day-of-week`
- Examples:
  - `*/10 * * * *` - Every 10 minutes
  - `0 */1 * * *` - Every hour at minute 0
  - `15 4 * * *` - Daily at 4:15 AM
  - `0 2 1 * *` - First day of month at 2:00 AM

### 6. Testing

Create tests in `__tests__/cron/` directory:

```typescript
import cron from '../../src/cron/yourCron';

describe('yourCron', () => {
  it('should execute successfully', async () => {
    const mockCon = createMockConnection();
    const mockLogger = createMockLogger();
    const mockPubsub = createMockPubsub();
    
    await cron.handler(mockCon, mockLogger, mockPubsub);
    
    // Assertions
  });
});
```

## Common Patterns

### Incremental Processing with Checkpoints

```typescript
const cron: Cron = {
  name: 'incremental-update',
  handler: async (con) => {
    const checkpointKey = 'last_incremental_update';
    const before = new Date();
    let checkpoint = await con
      .getRepository(Checkpoint)
      .findOneBy({ key: checkpointKey });
    const after = checkpoint?.timestamp || new Date(0);

    await con.transaction(async (entityManager) => {
      // Process records between 'after' and 'before'
      // Update checkpoint
      checkpoint.timestamp = before;
      await entityManager.getRepository(Checkpoint).save(checkpoint);
    });
  },
};
```

### Publishing Pub/Sub Messages

```typescript
handler: async (con, logger, pubsub) => {
  const items = await con.getRepository(Entity).find();
  
  for (const item of items) {
    await pubsub.topic('your-topic').publishMessage({
      json: { id: item.id, data: item.data },
    });
  }
}
```

### Batch Processing

```typescript
handler: async (con, logger) => {
  const batchSize = 100;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await con
      .getRepository(Entity)
      .find({ take: batchSize, skip: offset });
    
    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch
    await processBatch(batch);
    
    offset += batchSize;
    logger.info({ processed: offset }, 'Progress update');
  }
}
```

## Infrastructure Details

### Kubernetes CronJobs

Crons are deployed as Kubernetes CronJobs via Pulumi:

- **Command**: `['dumb-init', 'node', 'bin/cli', 'cron', '<cron-name>']`
- **Spot Instances**: Enabled by default (70% weight) for cost optimization
- **Default Limits**: Memory and CPU limits can be overridden per cron
- **Default Deadline**: 300 seconds (5 minutes), configurable per cron
- **Adhoc Environments**: Crons are disabled in adhoc environments (see `.infra/index.ts`)

### Resource Configuration

Configure resources in `.infra/crons.ts`:

```typescript
{
  name: 'memory-intensive-cron',
  schedule: '0 2 * * *',
  limits: {
    memory: '2Gi', // Maximum memory
  },
  requests: {
    cpu: '500m',    // CPU request
    memory: '1Gi',  // Memory request
  },
  activeDeadlineSeconds: 600, // 10 minutes max execution
}
```

## Troubleshooting

### Cron Not Running

1. Check that the cron name matches in all three places:
   - `src/cron/yourCron.ts` (name property)
   - `src/cron/index.ts` (imported and added to array)
   - `.infra/crons.ts` (name in config)

2. Verify the cron is deployed:
   ```bash
   kubectl get cronjobs -n <namespace>
   ```

3. Check cron job logs:
   ```bash
   kubectl logs -n <namespace> job/<cron-job-name>-<timestamp>
   ```

### Cron Failing

1. Check Kubernetes events:
   ```bash
   kubectl describe cronjob <cron-name> -n <namespace>
   ```

2. Review logs for errors
3. Verify database connectivity and permissions
4. Check resource limits (may be OOMKilled)

### Testing Locally

Always test crons locally before deploying:

```bash
# Set up environment variables
export DATABASE_URL=...
export REDIS_URL=...

# Run the cron
pnpm run cli cron your-cron-name
```

## Related Documentation

- **Workers**: See `src/workers/AGENTS.md` for background workers (Pub/Sub message handlers)
- **CLI**: See `bin/cli.ts` for CLI command structure
- **Infrastructure**: See `.infra/index.ts` for deployment configuration

