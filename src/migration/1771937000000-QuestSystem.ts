import { MigrationInterface, QueryRunner } from 'typeorm';

const questIds = {
  holdMyUpvote: '4b9f1e2d-7c84-4c51-8f2a-5c9c7a1d3101',
  teacher: '7e2d3c44-1b7f-4d9e-9b61-6d4b3f8a3102',
  commissioner: 'c13a8d57-9e42-4f18-8cb4-2a7f5e6b3103',
  thisCommentCooked: '2f4d9b61-6c3e-4a75-9d28-7b1e5f8c3104',
  wellActually: '91b7c2d4-5e68-4f31-8ac9-3d7e1b6a3105',
  savingThisForLater: '6d3e8f21-4a75-4c9b-8e12-5f7a1c2d3106',
  tldrIActuallyReadIt: '8a5c1d7e-2f34-4b96-9c41-1e7d3a5b3107',
  swipeTribunal: '3c7e1a5d-8b42-4f69-8d13-6a2c9e7b3108',
  newMutualUnlocked: '5f2a9c7d-1e64-4b38-9a75-4d8b1c6e3109',
  broReadThis: '1d6b4f8a-3c52-4e97-8b21-7f5a2d9c3110',
  chiefExecutive: '9c4e1b7d-6a35-4f82-8d54-2b7e1c6a3111',
  cantHoldAllTheseUpvotes: '4e8a2d6c-7b13-4c95-9f41-5d1a7b3e3112',
  knowledgeIsPower: '7b1d5f9a-2c64-4e38-8a75-6c3e1d4b3113',
  certifiedReplyGoblin: '2a6c9e1d-5f43-4b87-9c12-8d7a3e1b3114',
  commentHypeTrain: '8d3b7a1e-4c52-4f96-8b41-1a6d5c7e3115',
  openTabsFinalBoss: '5a1e4d8b-7c63-4b29-9f75-3e1d6a2c3116',
  briefBingeArc: '1c7a5d3e-8b42-4f61-8d94-7a2e1c5b3117',
  mutualsAnyPercentSpeedrun: '6b2d8f4a-1e57-4c93-9a21-5f7d3b1e3118',
  supremeCourtOfTakes: '3e9b1c7d-5a64-4f28-8c75-2d6a1e4b3119',
  squadCollector: '7a4d2e8c-1b53-4c97-9f16-8e3b5a1d3120',
} as const;

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
        "id",
        "name",
        "description",
        "type",
        "eventType",
        "criteria",
        "active"
      )
      VALUES
        (
          '${questIds.holdMyUpvote}',
          'Hold my upvote',
          'Upvote 5 posts',
          'daily',
          'post_upvote',
          '{"targetCount": 5}',
          true
        ),
        (
          '${questIds.teacher}',
          'Share the Wisdom',
          'Have 5 users click your shared daily.dev post link',
          'daily',
          'share_post_click',
          '{"targetCount": 5}',
          true
        ),
        (
          '${questIds.commissioner}',
          'Chairman of the Guild',
          'Give another user an award',
          'daily',
          'award_given',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.thisCommentCooked}',
          'Community Council',
          'Upvote 3 comments',
          'daily',
          'comment_upvote',
          '{"targetCount": 3}',
          true
        ),
        (
          '${questIds.wellActually}',
          'I''m About to Cook...',
          'Write 2 comments',
          'daily',
          'comment_create',
          '{"targetCount": 2}',
          true
        ),
        (
          '${questIds.savingThisForLater}',
          'I''ll Get to It Any Day Now...',
          'Bookmark 3 posts',
          'daily',
          'bookmark_post',
          '{"targetCount": 3}',
          true
        ),
        (
          '${questIds.tldrIActuallyReadIt}',
          'Debriefed',
          'Read 2 briefs',
          'daily',
          'brief_read',
          '{"targetCount": 2}',
          true
        ),
        (
          '${questIds.swipeTribunal}',
          'Douse the Flames',
          'Vote on 8 hot takes',
          'daily',
          'hot_take_vote',
          '{"targetCount": 8}',
          true
        ),
        (
          '${questIds.newMutualUnlocked}',
          'Don''t Mind Me...',
          'Follow 1 user',
          'daily',
          'user_follow',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.broReadThis}',
          'Hey, Check This Out...',
          'Share 1 post',
          'daily',
          'post_share',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.chiefExecutive}',
          'Chief Executive',
          'Give out 5 awards',
          'weekly',
          'award_given',
          '{"targetCount": 5}',
          true
        ),
        (
          '${questIds.cantHoldAllTheseUpvotes}',
          'Can''t hold all these upvotes',
          'Upvote 50 posts',
          'weekly',
          'post_upvote',
          '{"targetCount": 50}',
          true
        ),
        (
          '${questIds.knowledgeIsPower}',
          'Knowledge is power',
          'Have 100 clicks on your shared posts',
          'weekly',
          'share_post_click',
          '{"targetCount": 100}',
          true
        ),
        (
          '${questIds.certifiedReplyGoblin}',
          'A Beacon of the Community',
          'Write 12 comments',
          'weekly',
          'comment_create',
          '{"targetCount": 12}',
          true
        ),
        (
          '${questIds.commentHypeTrain}',
          'I Approve of This Message',
          'Upvote 20 comments',
          'weekly',
          'comment_upvote',
          '{"targetCount": 20}',
          true
        ),
        (
          '${questIds.openTabsFinalBoss}',
          'I Swear I''ll Get Around to These',
          'Bookmark 12 posts',
          'weekly',
          'bookmark_post',
          '{"targetCount": 12}',
          true
        ),
        (
          '${questIds.briefBingeArc}',
          'Commander in Chief',
          'Read 5 briefs',
          'weekly',
          'brief_read',
          '{"targetCount": 5}',
          true
        ),
        (
          '${questIds.mutualsAnyPercentSpeedrun}',
          'Mutuals Any% Speedrun',
          'Follow 5 users',
          'weekly',
          'user_follow',
          '{"targetCount": 5}',
          true
        ),
        (
          '${questIds.supremeCourtOfTakes}',
          'It''s Getting Cold in Here',
          'Vote on 40 hot takes',
          'weekly',
          'hot_take_vote',
          '{"targetCount": 40}',
          true
        ),
        (
          '${questIds.squadCollector}',
          'Squad Collector',
          'Join 2 squads',
          'weekly',
          'squad_join',
          '{"targetCount": 2}',
          true
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_reward" ("questId", "type", "amount")
      VALUES
        ('${questIds.holdMyUpvote}', 'xp', 10),
        ('${questIds.holdMyUpvote}', 'cores', 5),
        ('${questIds.teacher}', 'xp', 25),
        ('${questIds.teacher}', 'cores', 5),
        ('${questIds.commissioner}', 'xp', 50),
        ('${questIds.commissioner}', 'cores', 5),
        ('${questIds.thisCommentCooked}', 'xp', 15),
        ('${questIds.thisCommentCooked}', 'cores', 5),
        ('${questIds.wellActually}', 'xp', 20),
        ('${questIds.wellActually}', 'cores', 5),
        ('${questIds.savingThisForLater}', 'xp', 10),
        ('${questIds.savingThisForLater}', 'cores', 5),
        ('${questIds.tldrIActuallyReadIt}', 'xp', 10),
        ('${questIds.tldrIActuallyReadIt}', 'cores', 5),
        ('${questIds.swipeTribunal}', 'xp', 15),
        ('${questIds.swipeTribunal}', 'cores', 5),
        ('${questIds.newMutualUnlocked}', 'xp', 20),
        ('${questIds.newMutualUnlocked}', 'cores', 5),
        ('${questIds.broReadThis}', 'xp', 25),
        ('${questIds.broReadThis}', 'cores', 5),
        ('${questIds.chiefExecutive}', 'xp', 100),
        ('${questIds.chiefExecutive}', 'cores', 15),
        ('${questIds.cantHoldAllTheseUpvotes}', 'xp', 100),
        ('${questIds.cantHoldAllTheseUpvotes}', 'cores', 15),
        ('${questIds.knowledgeIsPower}', 'xp', 100),
        ('${questIds.knowledgeIsPower}', 'cores', 15),
        ('${questIds.certifiedReplyGoblin}', 'xp', 80),
        ('${questIds.certifiedReplyGoblin}', 'cores', 15),
        ('${questIds.commentHypeTrain}', 'xp', 70),
        ('${questIds.commentHypeTrain}', 'cores', 15),
        ('${questIds.openTabsFinalBoss}', 'xp', 60),
        ('${questIds.openTabsFinalBoss}', 'cores', 15),
        ('${questIds.briefBingeArc}', 'xp', 60),
        ('${questIds.briefBingeArc}', 'cores', 15),
        ('${questIds.mutualsAnyPercentSpeedrun}', 'xp', 80),
        ('${questIds.mutualsAnyPercentSpeedrun}', 'cores', 15),
        ('${questIds.supremeCourtOfTakes}', 'xp', 80),
        ('${questIds.supremeCourtOfTakes}', 'cores', 15),
        ('${questIds.squadCollector}', 'xp', 100),
        ('${questIds.squadCollector}', 'cores', 15)
    `);
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
