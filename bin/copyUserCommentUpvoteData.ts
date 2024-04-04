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
      INSERT INTO user_comment ("commentId", "userId", vote)
      SELECT "commentId", "userId", 1 AS vote
      FROM comment_upvote
      LIMIT ${limit} OFFSET ${offset}
      ON CONFLICT ("commentId", "userId") DO UPDATE SET vote = 1;
    `);

    await manager.query(`SET session_replication_role = DEFAULT;`);
  });

  process.exit();
})();
