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
      INSERT INTO content_preference ("userId", "referenceId", "type", "createdAt", "status", "keywordId", "feedId")
      SELECT f."userId", ft."tag", CASE WHEN ft."feedId" = f."userId" THEN 'keyword' ELSE 'feedKeyword' END, NOW(), CASE WHEN ft."blocked" = True THEN 'blocked' ELSE 'follow' END, ft."tag", ft."feedId"
      FROM feed_tag ft
      INNER JOIN feed f ON f."id" = ft."feedId"
      LIMIT ${limit} OFFSET ${offset}
      ON CONFLICT ("referenceId", "userId", "type", "feedId") DO NOTHING
    `);
  });

  process.exit();
})();
