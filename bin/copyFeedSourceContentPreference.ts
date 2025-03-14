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
    await manager.query(`
      INSERT INTO content_preference ("userId", "referenceId", "type", "createdAt", "status", "sourceId", "feedId", "flags")
      SELECT f."userId", fs."sourceId", 'source', NOW(), CASE WHEN fs."blocked" = True THEN 'blocked' ELSE 'follow' END, fs."sourceId", fs."feedId",  jsonb_build_object('role', 'member', 'referralToken', gen_random_uuid())
      FROM feed_source fs
      INNER JOIN feed f ON f."id" = fs."feedId" AND f."userId" = fs."feedId"
      LIMIT ${limit} OFFSET ${offset}
      ON CONFLICT ("referenceId", "userId", "type", "feedId") DO UPDATE
      SET
        status = EXCLUDED.status
    `);
  });

  process.exit();
})();
