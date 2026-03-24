import '../src/config';
import { Pool } from 'pg';
import createOrGetConnection from '../src/db';
import { logger as parentLogger } from '../src/logger';

const logger = parentLogger.child({ command: 'migrate-kratos-users' });

const BATCH_SIZE = 500;

type Cursor = {
  createdAt: Date;
  id: string;
};

const INITIAL_CURSOR: Cursor = {
  createdAt: new Date(0),
  id: '00000000-0000-0000-0000-000000000000',
};

const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString('base64');

const decodeCursor = (encoded: string): Cursor => {
  const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
  return { createdAt: new Date(parsed.createdAt), id: parsed.id };
};

type KratosPasswordRow = {
  identity_id: string;
  user_id: string;
  hashed_password: string;
  created_at: Date;
};

type KratosOidcRawRow = {
  identity_id: string;
  user_id: string;
  provider_subject: string;
  created_at: Date;
};

const getKratosPool = (): Pool => {
  const connectionString = process.env.KRATOS_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'KRATOS_DATABASE_URL is required (e.g. postgres://postgres:12345@localhost:5432/heimdall)',
    );
  }
  return new Pool({ connectionString, max: 5 });
};

const fetchPasswordIdentities = async (
  kratosPool: Pool,
  cursor: Cursor,
): Promise<KratosPasswordRow[]> => {
  const { rows } = await kratosPool.query<KratosPasswordRow>(
    `SELECT
       i.id AS identity_id,
       i.traits->>'userId' AS user_id,
       ic.config->>'hashed_password' AS hashed_password,
       i.created_at
     FROM identities i
     JOIN identity_credentials ic ON ic.identity_id = i.id
     JOIN identity_credential_types ict ON ict.id = ic.identity_credential_type_id
     WHERE ict.name = 'password'
       AND i.traits->>'userId' IS NOT NULL
       AND ic.config->>'hashed_password' IS NOT NULL
       AND (i.created_at, i.id) > ($1, $2)
     ORDER BY i.created_at, i.id
     LIMIT $3`,
    [cursor.createdAt, cursor.id, BATCH_SIZE],
  );
  return rows;
};

const fetchOidcIdentities = async (
  kratosPool: Pool,
  cursor: Cursor,
): Promise<KratosOidcRawRow[]> => {
  const { rows } = await kratosPool.query<KratosOidcRawRow>(
    `SELECT
       i.id AS identity_id,
       i.traits->>'userId' AS user_id,
       ici.identifier AS provider_subject,
       i.created_at
     FROM identities i
     JOIN identity_credentials ic ON ic.identity_id = i.id
     JOIN identity_credential_types ict ON ict.id = ic.identity_credential_type_id
     JOIN identity_credential_identifiers ici ON ici.identity_credential_id = ic.id
     WHERE ict.name = 'oidc'
       AND i.traits->>'userId' IS NOT NULL
       AND (i.created_at, i.id) > ($1, $2)
     ORDER BY i.created_at, i.id
     LIMIT $3`,
    [cursor.createdAt, cursor.id, BATCH_SIZE],
  );
  return rows;
};

const cursorFromRow = (row: {
  created_at: Date;
  identity_id: string;
}): Cursor => ({
  createdAt: row.created_at,
  id: row.identity_id,
});

type MigrateResult = {
  count: number;
  cursor: Cursor;
};

const migratePasswordAccounts = async (
  kratosPool: Pool,
  dailyPool: Pool,
  initialCursor: Cursor,
): Promise<MigrateResult> => {
  let cursor = initialCursor;
  let total = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await fetchPasswordIdentities(kratosPool, cursor);
    if (batch.length === 0) break;

    const now = new Date().toISOString();
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      const identity = batch[i];
      const base = i * 4;
      placeholders.push(
        `($${base + 1}, $${base + 2}, 'credential', $${base + 2}, $${base + 3}, $${base + 4}, $${base + 4})`,
      );
      values.push(
        `${identity.user_id}-credential`,
        identity.user_id,
        identity.hashed_password,
        now,
      );
    }

    const { rowCount } = await dailyPool.query(
      `INSERT INTO ba_account (id, "userId", "providerId", "accountId", password, "createdAt", "updatedAt")
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (id) DO NOTHING`,
      values,
    );
    total += rowCount ?? 0;

    cursor = cursorFromRow(batch[batch.length - 1]);
    logger.info(
      {
        cursor: cursor.createdAt,
        batchSize: batch.length,
        inserted: rowCount,
        total,
      },
      'Migrated password batch',
    );

    if (batch.length < BATCH_SIZE) break;
  }

  return { count: total, cursor };
};

const migrateOidcAccounts = async (
  kratosPool: Pool,
  dailyPool: Pool,
  initialCursor: Cursor,
): Promise<MigrateResult> => {
  let cursor = initialCursor;
  let total = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rawBatch = await fetchOidcIdentities(kratosPool, cursor);
    if (rawBatch.length === 0) break;

    cursor = cursorFromRow(rawBatch[rawBatch.length - 1]);

    const now = new Date().toISOString();
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let batchCount = 0;

    for (const row of rawBatch) {
      const parts = row.provider_subject?.split(':') ?? [];
      const provider = parts[0] ?? '';
      const subject = parts.slice(1).join(':');
      if (!provider || !subject) continue;

      const base = batchCount * 5;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 5})`,
      );
      values.push(
        `${row.user_id}-${provider}`,
        row.user_id,
        provider,
        subject,
        now,
      );
      batchCount++;
    }

    if (placeholders.length === 0) continue;

    const { rowCount } = await dailyPool.query(
      `INSERT INTO ba_account (id, "userId", "providerId", "accountId", "createdAt", "updatedAt")
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (id) DO NOTHING`,
      values,
    );
    total += rowCount ?? 0;

    logger.info(
      {
        cursor: cursor.createdAt,
        batchSize: rawBatch.length,
        inserted: rowCount,
        total,
      },
      'Migrated OIDC batch',
    );

    if (rawBatch.length < BATCH_SIZE) break;
  }

  return { count: total, cursor };
};

(async (): Promise<void> => {
  const kratosPool = getKratosPool();
  const con = await createOrGetConnection();
  const dailyPool = (con.driver as unknown as { master: Pool }).master;
  const cursorArg = process.argv[2];
  const startCursor = cursorArg ? decodeCursor(cursorArg) : INITIAL_CURSOR;

  try {
    logger.info(
      { resumeFrom: startCursor.createdAt },
      'Starting Kratos to BetterAuth user migration',
    );

    const password = await migratePasswordAccounts(
      kratosPool,
      dailyPool,
      startCursor,
    );
    logger.info(
      { count: password.count },
      'Password account migration complete',
    );

    const oidc = await migrateOidcAccounts(kratosPool, dailyPool, startCursor);
    logger.info({ count: oidc.count }, 'OIDC account migration complete');

    const endCursor =
      password.cursor.createdAt > oidc.cursor.createdAt
        ? password.cursor
        : oidc.cursor;
    const encoded = encodeCursor(endCursor);

    logger.info(
      {
        passwordCount: password.count,
        oidcCount: oidc.count,
        cursor: encoded,
      },
      'Kratos to BetterAuth migration complete',
    );
    console.log(`\nResume cursor: ${encoded}`);
  } finally {
    await kratosPool.end();
  }

  process.exit();
})();
