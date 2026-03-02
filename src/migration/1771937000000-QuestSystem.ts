import { MigrationInterface, QueryRunner } from 'typeorm';

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_IN_MS = 7 * ONE_DAY_IN_MS;

const getUtcDayStart = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const getUtcWeekStart = (date: Date): Date => {
  const dayStart = getUtcDayStart(date);
  const dayOfWeek = dayStart.getUTCDay(); // 0 = Sunday, 1 = Monday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return new Date(dayStart.getTime() - daysSinceMonday * ONE_DAY_IN_MS);
};

export class QuestSystem1771937000000 implements MigrationInterface {
  name = 'QuestSystem1771937000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "quest" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" text NOT NULL,
        "description" text NOT NULL,
        "type" text NOT NULL,
        "plusOnly" boolean NOT NULL DEFAULT false,
        "eventType" text NOT NULL,
        "criteria" jsonb NOT NULL DEFAULT '{}',
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_quest_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quest_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_quest_type_value"
        ON "quest" ("type")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_quest_eventType_value"
        ON "quest" ("eventType")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_quest_type_active"
        ON "quest" ("type", "active")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "quest_reward" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "questId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "type" text NOT NULL,
        "amount" integer NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_quest_reward_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_quest_reward_questId"
        ON "quest_reward" ("questId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quest_reward_questId_type"
        ON "quest_reward" ("questId", "type")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "quest_reward"
        ADD CONSTRAINT "FK_quest_reward_quest_id"
          FOREIGN KEY ("questId")
          REFERENCES "quest"("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "quest_rotation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "questId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "type" text NOT NULL,
        "plusOnly" boolean NOT NULL DEFAULT false,
        "slot" smallint NOT NULL,
        "periodStart" TIMESTAMP NOT NULL,
        "periodEnd" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_quest_rotation_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_quest_rotation_type_period"
        ON "quest_rotation" ("type", "periodStart", "periodEnd")
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quest_rotation_slot_period"
        ON "quest_rotation" ("type", "plusOnly", "slot", "periodStart")
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quest_rotation_quest_period"
        ON "quest_rotation" ("questId", "periodStart")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "quest_rotation"
        ADD CONSTRAINT "FK_quest_rotation_quest_id"
          FOREIGN KEY ("questId")
          REFERENCES "quest"("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_quest" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rotationId" uuid NOT NULL,
        "userId" character varying(36) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "progress" integer NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'in_progress',
        "completedAt" TIMESTAMP,
        "claimedAt" TIMESTAMP,
        CONSTRAINT "PK_user_quest_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_quest_user_rotation" UNIQUE ("rotationId", "userId")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_quest_userId_status"
        ON "user_quest" ("userId", "status")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_quest"
        ADD CONSTRAINT "FK_user_quest_rotation_id"
          FOREIGN KEY ("rotationId")
          REFERENCES "quest_rotation"("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_quest"
        ADD CONSTRAINT "FK_user_quest_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_quest"
        REPLICA IDENTITY FULL
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_quest_profile" (
        "userId" character varying(36) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "totalXp" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_quest_profile" PRIMARY KEY ("userId")
      )
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_quest_profile"
        ADD CONSTRAINT "FK_user_quest_profile_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest" (
        "name",
        "description",
        "type",
        "plusOnly",
        "eventType",
        "criteria",
        "active"
      )
      VALUES
        (
          'Hold my upvote',
          'Upvote 5 posts',
          'daily',
          false,
          'post_upvote',
          '{"targetCount": 5}',
          true
        ),
        (
          'Teacher',
          'Have 5 users click your shared daily.dev post link',
          'daily',
          false,
          'share_post_click',
          '{"targetCount": 5}',
          true
        ),
        (
          'Commissioner',
          'Give another user an award',
          'daily',
          false,
          'award_given',
          '{"targetCount": 1}',
          true
        ),
        (
          'This Comment Cooked',
          'Upvote 3 comments',
          'daily',
          false,
          'comment_upvote',
          '{"targetCount": 3}',
          true
        ),
        (
          'Well, Actually...',
          'Write 2 comments',
          'daily',
          false,
          'comment_create',
          '{"targetCount": 2}',
          true
        ),
        (
          'Saving This for Later',
          'Bookmark 3 posts',
          'daily',
          false,
          'bookmark_post',
          '{"targetCount": 3}',
          true
        ),
        (
          'TL;DR? I Actually Read It',
          'Read 2 briefs',
          'daily',
          false,
          'brief_read',
          '{"targetCount": 2}',
          true
        ),
        (
          'Swipe Tribunal',
          'Vote on 8 hot takes',
          'daily',
          false,
          'hot_take_vote',
          '{"targetCount": 8}',
          true
        ),
        (
          'New Mutual Unlocked',
          'Follow 1 user',
          'daily',
          false,
          'user_follow',
          '{"targetCount": 1}',
          true
        ),
        (
          'Bro, Read This',
          'Share 1 post',
          'daily',
          false,
          'post_share',
          '{"targetCount": 1}',
          true
        ),
        (
          'Chief Executive',
          'Give out 5 awards',
          'weekly',
          false,
          'award_given',
          '{"targetCount": 5}',
          true
        ),
        (
          'Can''t hold all these upvotes',
          'Upvote 50 posts',
          'weekly',
          false,
          'post_upvote',
          '{"targetCount": 50}',
          true
        ),
        (
          'Knowledge is power',
          'Have 100 clicks on your shared posts',
          'weekly',
          false,
          'share_post_click',
          '{"targetCount": 100}',
          true
        ),
        (
          'Certified Reply Goblin',
          'Write 12 comments',
          'weekly',
          false,
          'comment_create',
          '{"targetCount": 12}',
          true
        ),
        (
          'Comment Hype Train',
          'Upvote 20 comments',
          'weekly',
          false,
          'comment_upvote',
          '{"targetCount": 20}',
          true
        ),
        (
          'Open Tabs Final Boss',
          'Bookmark 12 posts',
          'weekly',
          false,
          'bookmark_post',
          '{"targetCount": 12}',
          true
        ),
        (
          'Brief Binge Arc',
          'Read 10 briefs',
          'weekly',
          false,
          'brief_read',
          '{"targetCount": 10}',
          true
        ),
        (
          'Mutuals Any% Speedrun',
          'Follow 5 users',
          'weekly',
          false,
          'user_follow',
          '{"targetCount": 5}',
          true
        ),
        (
          'Supreme Court of Takes',
          'Vote on 40 hot takes',
          'weekly',
          false,
          'hot_take_vote',
          '{"targetCount": 40}',
          true
        ),
        (
          'Squad Collector',
          'Join 2 squads',
          'weekly',
          false,
          'squad_join',
          '{"targetCount": 2}',
          true
        ),
        (
          'Hold my upvote+',
          'Upvote 15 posts',
          'daily',
          true,
          'post_upvote',
          '{"targetCount": 15}',
          true
        ),
        (
          'Knowledge is power+',
          'Have 200 clicks on your shared posts',
          'weekly',
          true,
          'share_post_click',
          '{"targetCount": 200}',
          true
        )
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_reward" ("questId", "type", "amount")
      SELECT q.id, v.type, v.amount
      FROM (
        VALUES
          ('Hold my upvote', 'xp', 10),
          ('Hold my upvote', 'reputation', 10),
          ('Teacher', 'xp', 25),
          ('Teacher', 'reputation', 50),
          ('Commissioner', 'xp', 50),
          ('Commissioner', 'reputation', 150),
          ('This Comment Cooked', 'xp', 15),
          ('This Comment Cooked', 'reputation', 20),
          ('Well, Actually...', 'xp', 20),
          ('Well, Actually...', 'reputation', 25),
          ('Saving This for Later', 'xp', 10),
          ('Saving This for Later', 'reputation', 10),
          ('TL;DR? I Actually Read It', 'xp', 10),
          ('TL;DR? I Actually Read It', 'reputation', 10),
          ('Swipe Tribunal', 'xp', 15),
          ('Swipe Tribunal', 'reputation', 15),
          ('New Mutual Unlocked', 'xp', 20),
          ('New Mutual Unlocked', 'reputation', 20),
          ('Bro, Read This', 'xp', 25),
          ('Bro, Read This', 'reputation', 30),
          ('Chief Executive', 'xp', 100),
          ('Chief Executive', 'reputation', 500),
          ('Chief Executive', 'cores', 50),
          ('Can''t hold all these upvotes', 'xp', 100),
          ('Can''t hold all these upvotes', 'cores', 50),
          ('Knowledge is power', 'xp', 100),
          ('Knowledge is power', 'reputation', 300),
          ('Certified Reply Goblin', 'xp', 80),
          ('Certified Reply Goblin', 'reputation', 150),
          ('Certified Reply Goblin', 'cores', 20),
          ('Comment Hype Train', 'xp', 70),
          ('Comment Hype Train', 'reputation', 120),
          ('Comment Hype Train', 'cores', 20),
          ('Open Tabs Final Boss', 'xp', 60),
          ('Open Tabs Final Boss', 'reputation', 80),
          ('Open Tabs Final Boss', 'cores', 20),
          ('Brief Binge Arc', 'xp', 60),
          ('Brief Binge Arc', 'reputation', 90),
          ('Brief Binge Arc', 'cores', 20),
          ('Mutuals Any% Speedrun', 'xp', 80),
          ('Mutuals Any% Speedrun', 'reputation', 140),
          ('Mutuals Any% Speedrun', 'cores', 30),
          ('Supreme Court of Takes', 'xp', 80),
          ('Supreme Court of Takes', 'reputation', 120),
          ('Supreme Court of Takes', 'cores', 25),
          ('Squad Collector', 'xp', 100),
          ('Squad Collector', 'reputation', 200),
          ('Squad Collector', 'cores', 30),
          ('Hold my upvote+', 'xp', 40),
          ('Hold my upvote+', 'reputation', 100),
          ('Hold my upvote+', 'cores', 20),
          ('Knowledge is power+', 'xp', 200),
          ('Knowledge is power+', 'reputation', 600),
          ('Knowledge is power+', 'cores', 100)
      ) AS v(name, type, amount)
      INNER JOIN "quest" q ON q.name = v.name
      ON CONFLICT ("questId", "type") DO NOTHING
    `);

    const now = new Date();
    const dayStart = getUtcDayStart(now);
    const dayEnd = new Date(dayStart.getTime() + ONE_DAY_IN_MS);
    const weekStart = getUtcWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + ONE_WEEK_IN_MS);

    await queryRunner.query(
      /* sql */ `
        WITH regular_quests AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC)::smallint AS slot
          FROM "quest"
          WHERE "type" = 'daily'
            AND "plusOnly" = false
            AND "active" = true
          LIMIT 2
        ),
        plus_quests AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC)::smallint AS slot
          FROM "quest"
          WHERE "type" = 'daily'
            AND "plusOnly" = true
            AND "active" = true
          LIMIT 1
        ),
        selected AS (
          SELECT id, false AS "plusOnly", slot FROM regular_quests
          UNION ALL
          SELECT id, true AS "plusOnly", slot FROM plus_quests
        )
        INSERT INTO "quest_rotation" (
          "questId",
          "type",
          "plusOnly",
          "slot",
          "periodStart",
          "periodEnd"
        )
        SELECT
          s.id,
          'daily',
          s."plusOnly",
          s.slot,
          $1,
          $2
        FROM selected s
        ON CONFLICT ("type", "plusOnly", "slot", "periodStart") DO NOTHING
      `,
      [dayStart, dayEnd],
    );

    await queryRunner.query(
      /* sql */ `
        WITH regular_quests AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC)::smallint AS slot
          FROM "quest"
          WHERE "type" = 'weekly'
            AND "plusOnly" = false
            AND "active" = true
          LIMIT 1
        ),
        plus_quests AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC)::smallint AS slot
          FROM "quest"
          WHERE "type" = 'weekly'
            AND "plusOnly" = true
            AND "active" = true
          LIMIT 1
        ),
        selected AS (
          SELECT id, false AS "plusOnly", slot FROM regular_quests
          UNION ALL
          SELECT id, true AS "plusOnly", slot FROM plus_quests
        )
        INSERT INTO "quest_rotation" (
          "questId",
          "type",
          "plusOnly",
          "slot",
          "periodStart",
          "periodEnd"
        )
        SELECT
          s.id,
          'weekly',
          s."plusOnly",
          s.slot,
          $1,
          $2
        FROM selected s
        ON CONFLICT ("type", "plusOnly", "slot", "periodStart") DO NOTHING
      `,
      [weekStart, weekEnd],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "user_quest_profile"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "user_quest"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "quest_rotation"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "quest_reward"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "quest"
    `);
  }
}
