import '../src/config';
import createOrGetConnection from '../src/db';

(async (): Promise<void> => {
  const limitArgument = process.argv[2];
  const offsetArgument = process.argv[3];

  if (!limitArgument || !offsetArgument) {
    throw new Error('limit and offset arguments are required');
  }

  const limit = +limitArgument;

  if (Number.isNaN(limit)) {
    throw new Error('limit argument is invalid, it should be a number');
  }

  const offset = +offsetArgument;

  if (Number.isNaN(offset)) {
    throw new Error('offset argument is invalid, it should be a number');
  }

  const con = await createOrGetConnection();

  await con.transaction(async (manager) => {
    await manager.query(`SET session_replication_role = replica;`);

    await manager.query(`
      INSERT INTO content_preference ("userId", "referenceId", "type", "createdAt", "status", "sourceId", "flags")
      SELECT sm."userId", sm."sourceId", 'source', NOW(), CASE WHEN sm."role" = 'blocked' THEN 'blocked' ELSE 'subscribed' END, sm."sourceId", jsonb_build_object('role', sm."role", 'referralToken', sm."referralToken")
      FROM source_member sm
      LIMIT ${limit} OFFSET ${offset}
      ON CONFLICT ("referenceId", "userId") DO UPDATE
      SET
        status = EXCLUDED.status,
        flags = content_preference.flags || EXCLUDED.flags
    `);

    await manager.query(`SET session_replication_role = DEFAULT;`);
  });

  process.exit();
})();
