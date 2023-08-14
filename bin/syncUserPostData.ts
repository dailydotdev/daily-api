import '../src/config';
import createOrGetConnection from '../src/db';
import { Downvote, HiddenPost, Upvote } from '../src/entity';

(async (): Promise<void> => {
  const entityArgument = process.argv[2];
  const createdFromArgument = process.argv[3];
  const createdToArgument = process.argv[4];

  const argumentToEntityMap = {
    Upvote: Upvote,
    Downvote: Downvote,
    HiddenPost: HiddenPost,
  };
  const entity = argumentToEntityMap[entityArgument];

  if (!entity) {
    throw new Error(
      `Invalid entity, select one from: ${Object.keys(argumentToEntityMap).join(
        ', ',
      )}`,
    );
  }

  if (!createdFromArgument || !createdToArgument) {
    throw new Error('createdFrom and createdTo arguments are required');
  }

  const createdFromDate = new Date(createdFromArgument);

  if (Number.isNaN(createdFromDate.getTime())) {
    throw new Error(
      'createdFromDate argument is invalid, format should be ISO 6801',
    );
  }

  const createdToDate = new Date(createdToArgument);

  if (Number.isNaN(createdToDate.getTime())) {
    throw new Error(
      'createdToDate argument is invalid, format should be ISO 6801',
    );
  }

  if (createdFromDate > createdToDate) {
    throw new Error(
      'createdFrom argument should be less than createdTo argument',
    );
  }

  const con = await createOrGetConnection();

  await con.transaction(async (manager) => {
    switch (entity) {
      case Upvote:
        await manager.query(`
          INSERT INTO user_post ("postId", "userId", vote)
          SELECT "postId", "userId", 1 AS vote
          FROM upvote
          WHERE "createdAt" > '${createdFromDate.toISOString()}' AND "createdAt" < '${createdToDate.toISOString()}'
          ON CONFLICT ("postId", "userId") DO UPDATE SET vote = 1;
        `);
        await manager.query(`
          INSERT INTO user_post ("postId", "userId", "votedAt")
          SELECT "postId", "userId", "createdAt" as "votedAt"
          FROM upvote
          WHERE "createdAt" > '${createdFromDate.toISOString()}' AND "createdAt" < '${createdToDate.toISOString()}'
          ON CONFLICT ("postId", "userId") DO UPDATE SET "votedAt" = EXCLUDED."votedAt";
        `);
        break;
      case Downvote:
        await manager.query(`
          INSERT INTO user_post ("postId", "userId", vote)
          SELECT "postId", "userId", -1 AS vote
          FROM downvote
          WHERE "createdAt" > '${createdFromDate.toISOString()}' AND "createdAt" < '${createdToDate.toISOString()}'
          ON CONFLICT ("postId", "userId") DO UPDATE SET vote = -1;
        `);
        await manager.query(`
          INSERT INTO user_post ("postId", "userId", "votedAt")
          SELECT "postId", "userId", "createdAt" as "votedAt"
          FROM downvote
          WHERE "createdAt" > '${createdFromDate.toISOString()}' AND "createdAt" < '${createdToDate.toISOString()}'
          ON CONFLICT ("postId", "userId") DO UPDATE SET "votedAt" = EXCLUDED."votedAt";
        `);
        break;
      case HiddenPost:
        await manager.query(`
          INSERT INTO user_post ("postId", "userId", hidden)
          SELECT "postId", "userId", true AS hidden
          FROM hidden_post
          ON CONFLICT ("postId", "userId") DO UPDATE SET hidden = true;
        `);
        break;
      default:
        throw new Error('Unhandled entity');
    }
  });

  process.exit();
})();
