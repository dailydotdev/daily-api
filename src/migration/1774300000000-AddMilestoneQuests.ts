import { MigrationInterface, QueryRunner } from 'typeorm';

const questIds = {
  localCelebrity: '31c4f2aa-1358-4e21-8e77-1b5d02ae5001',
  celebrity: '4d79a6f3-2469-41fd-98d2-2c6e13bf5002',
  upToDate: '5e8ab704-357a-4dce-8a63-3d7f24cf5003',
  livingEncyclopedia: '6f9bc815-468b-4f9a-9b74-4e8a35df5004',
  wellConnected: '70acd926-579c-4c6f-8c85-5f9b46ef5005',
  upAndComer: '81bde037-68ad-45f1-8d96-60ac57ff5006',
  famedAdventurer: '92cef148-79be-4a82-8ea7-71bd680f5007',
  upUpAndAway: 'a3df0259-8acf-4b13-8fb8-82ce791f5008',
} as const;

const rotationIds = {
  localCelebrity: 'b4e1036a-9be0-4ca4-90c9-93df8a2f5001',
  celebrity: 'c5f2147b-acf1-4d35-91da-a4e09b3f5002',
  upToDate: 'd603258c-bd02-4ec6-92eb-b5f1ac4f5003',
  livingEncyclopedia: 'e714369d-ce13-4f57-93fc-c602bd5f5004',
  wellConnected: 'f82547ae-df24-4088-940d-d713ce6f5005',
  upAndComer: '093658bf-e035-4199-951e-e824df7f5006',
  famedAdventurer: '1a4769c0-f146-42aa-962f-f935e08f5007',
  upUpAndAway: '2b587ad1-0257-43bb-9740-0a46f19f5008',
} as const;

const questIdValues = Object.values(questIds)
  .map((id) => `'${id}'`)
  .join(', ');

const milestonePeriodStart = '2026-03-25 00:00:00';
const milestonePeriodEnd = '9999-12-31 23:59:59';

export class AddMilestoneQuests1774300000000 implements MigrationInterface {
  name = 'AddMilestoneQuests1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
          '${questIds.localCelebrity}',
          'Local celebrity',
          'Gain 100 followers',
          'milestone',
          'follower_gain',
          '{"targetCount": 100}',
          true
        ),
        (
          '${questIds.celebrity}',
          'Celebrity',
          'Gain 1,000 followers',
          'milestone',
          'follower_gain',
          '{"targetCount": 1000}',
          true
        ),
        (
          '${questIds.upToDate}',
          'Up to date',
          'Read 1,000 articles',
          'milestone',
          'brief_read',
          '{"targetCount": 1000}',
          true
        ),
        (
          '${questIds.livingEncyclopedia}',
          'Living encyclopedia',
          'Read 10,000 articles',
          'milestone',
          'brief_read',
          '{"targetCount": 10000}',
          true
        ),
        (
          '${questIds.wellConnected}',
          'Well connected',
          'Refer 100 users',
          'milestone',
          'referral_count',
          '{"targetCount": 100}',
          true
        ),
        (
          '${questIds.upAndComer}',
          'Up and comer',
          'Complete 100 quests',
          'milestone',
          'quest_complete',
          '{"targetCount": 100}',
          true
        ),
        (
          '${questIds.famedAdventurer}',
          'Famed adventurer',
          'Complete 1,000 quests',
          'milestone',
          'quest_complete',
          '{"targetCount": 1000}',
          true
        ),
        (
          '${questIds.upUpAndAway}',
          'Up, up and away',
          'Receive 1,000 upvotes',
          'milestone',
          'upvote_received',
          '{"targetCount": 1000}',
          true
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_rotation" (
        "id",
        "questId",
        "type",
        "plusOnly",
        "slot",
        "periodStart",
        "periodEnd"
      )
      VALUES
        (
          '${rotationIds.localCelebrity}',
          '${questIds.localCelebrity}',
          'milestone',
          false,
          1,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        ),
        (
          '${rotationIds.celebrity}',
          '${questIds.celebrity}',
          'milestone',
          false,
          2,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        ),
        (
          '${rotationIds.upToDate}',
          '${questIds.upToDate}',
          'milestone',
          false,
          3,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        ),
        (
          '${rotationIds.livingEncyclopedia}',
          '${questIds.livingEncyclopedia}',
          'milestone',
          false,
          4,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        ),
        (
          '${rotationIds.wellConnected}',
          '${questIds.wellConnected}',
          'milestone',
          false,
          5,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        ),
        (
          '${rotationIds.upAndComer}',
          '${questIds.upAndComer}',
          'milestone',
          false,
          6,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        ),
        (
          '${rotationIds.famedAdventurer}',
          '${questIds.famedAdventurer}',
          'milestone',
          false,
          7,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        ),
        (
          '${rotationIds.upUpAndAway}',
          '${questIds.upUpAndAway}',
          'milestone',
          false,
          8,
          '${milestonePeriodStart}',
          '${milestonePeriodEnd}'
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_reward" ("questId", "type", "amount")
      VALUES
        ('${questIds.localCelebrity}', 'xp', 1000),
        ('${questIds.localCelebrity}', 'cores', 500),
        ('${questIds.celebrity}', 'xp', 5000),
        ('${questIds.celebrity}', 'cores', 1000),
        ('${questIds.upToDate}', 'xp', 1000),
        ('${questIds.upToDate}', 'cores', 200),
        ('${questIds.livingEncyclopedia}', 'xp', 5000),
        ('${questIds.livingEncyclopedia}', 'cores', 500),
        ('${questIds.wellConnected}', 'xp', 2000),
        ('${questIds.wellConnected}', 'cores', 1000),
        ('${questIds.upAndComer}', 'xp', 500),
        ('${questIds.upAndComer}', 'cores', 50),
        ('${questIds.famedAdventurer}', 'xp', 1000),
        ('${questIds.famedAdventurer}', 'cores', 100),
        ('${questIds.upUpAndAway}', 'xp', 1000),
        ('${questIds.upUpAndAway}', 'cores', 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "quest"
      WHERE "id" IN (${questIdValues})
    `);
  }
}
