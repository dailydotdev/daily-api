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
      INSERT INTO user_post ("postId", "userId", hidden)
      SELECT "postId", "userId", true AS hidden
      FROM hidden_post
      LIMIT ${limit} OFFSET ${offset}
      ON CONFLICT ("postId", "userId") DO UPDATE SET hidden = true;
    `);
  });

  process.exit();
})();
