---
name: local-env
description: Local environment management - run SQL queries, set up fake payments, reset test data. Use when the user needs help with local database operations or test data setup.
---

# Local Environment Management

Help with local development environment tasks for daily-api.

## Database Access

PostgreSQL runs locally via Docker in a k8s container.

### Finding the Container

```bash
docker ps --format "table {{.Names}}" | grep "k8s_app_postgres"
```

### Running Queries

```bash
docker exec <CONTAINER_NAME> psql -U postgres -d api -c "YOUR SQL QUERY"
```

For multi-line queries:

```bash
docker exec <CONTAINER_NAME> psql -U postgres -d api <<'EOF'
SELECT * FROM users LIMIT 1;
EOF
```

## Fake Payment Setup

Payment status for opportunities is tracked on the **Organization** level via `recruiterSubscriptionFlags`. Opportunities also store subscription info in their `flags` column.

### Organization Subscription Fields

| Field | Description |
|-------|-------------|
| `status` | Must be `'active'` for payment validation to pass |
| `provider` | Use `'paddle'` |
| `items[].quantity` | Number of opportunity "seats" available |
| `items[].priceId` | Price ID that opportunities reference |

### Opportunity Flags Fields

| Field | Description |
|-------|-------------|
| `plan` | Must match a `priceId` from the org's subscription items |
| `batchSize` | Number of candidates per batch |

### Fake Payment for Organization

```sql
UPDATE organization
SET "recruiterSubscriptionFlags" = jsonb_build_object(
  'status', 'active',
  'provider', 'paddle',
  'subscriptionId', 'fake_sub_123',
  'createdAt', now(),
  'updatedAt', now(),
  'items', jsonb_build_array(
    jsonb_build_object('priceId', 'pri_fake_123', 'quantity', 5)
  )
)
WHERE id = 'ORGANIZATION_ID';
```

Reset: `UPDATE organization SET "recruiterSubscriptionFlags" = '{}' WHERE id = 'ORGANIZATION_ID';`

### Fake Payment for Opportunity

Requires updating both the organization AND the opportunity:

```sql
-- Step 1: Update organization subscription
UPDATE organization
SET "recruiterSubscriptionFlags" = jsonb_build_object(
  'status', 'active',
  'provider', 'paddle',
  'subscriptionId', 'fake_sub_123',
  'createdAt', now(),
  'updatedAt', now(),
  'items', jsonb_build_array(
    jsonb_build_object('priceId', 'pri_fake_123', 'quantity', 5)
  )
)
WHERE id = (SELECT "organizationId" FROM opportunity WHERE id = 'OPPORTUNITY_ID');

-- Step 2: Update opportunity flags
UPDATE opportunity
SET flags = flags || jsonb_build_object(
  'plan', 'pri_fake_123',
  'batchSize', 50
)
WHERE id = 'OPPORTUNITY_ID';
```

Reset:
```sql
UPDATE organization SET "recruiterSubscriptionFlags" = '{}'
WHERE id = (SELECT "organizationId" FROM opportunity WHERE id = 'OPPORTUNITY_ID');

UPDATE opportunity SET flags = flags - 'plan' - 'batchSize'
WHERE id = 'OPPORTUNITY_ID';
```

## Instructions

When the user asks for local environment help:

1. **For SQL queries**: First find the postgres container, then execute via docker exec
2. **For fake payments**: Determine if they're providing an opportunity ID or organization ID, run the appropriate SQL
3. **Always verify**: After changes, run a SELECT to confirm
4. **Ask if unclear**: If the request is ambiguous, ask clarifying questions

Common requests:
- "Set up fake payment for opportunity X" → Run both org and opportunity updates
- "Set up fake payment for org X" → Run only org update
- "Run SQL: ..." → Execute via docker
- "Reset payment for X" → Run reset queries
- "Check subscription for X" → Query and display current state

## Continuous Improvement

This skill should evolve over time. When you discover new local environment operations, common testing patterns, or useful queries:

1. **Add them to this file** - Update the SKILL.md with new sections or examples
2. **Keep it practical** - Focus on operations that are frequently needed
3. **Document the why** - Explain what fields mean and why certain values are used

If a user asks for something not covered here, help them and then offer to add it to this skill for future use.
