# Local Testing Operations

Common SQL queries and operations for local development and testing.

## Opportunity & Recruiter Testing

### Fake Payment for an Opportunity

Payment status for opportunities is tracked on the **Organization** level via the `recruiterSubscriptionFlags` column. To simulate a paid subscription:

**If you know your organization ID:**

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
WHERE id = 'YOUR_ORGANIZATION_ID';
```

**If you know your opportunity ID:**

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
WHERE id = (SELECT "organizationId" FROM opportunity WHERE id = 'YOUR_OPPORTUNITY_ID');
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `status` | Must be `'active'` for payment validation to pass |
| `provider` | Use `'paddle'` |
| `items[].quantity` | Number of opportunity "seats" available |

**To reset/remove fake payment:**

```sql
UPDATE organization
SET "recruiterSubscriptionFlags" = '{}'
WHERE id = 'YOUR_ORGANIZATION_ID';
```

