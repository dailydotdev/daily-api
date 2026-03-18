import { MigrationInterface, QueryRunner } from 'typeorm';

const questIds = {
  arenaScout: 'ab39d1d0-8d29-4c6b-9a78-43e1142d4011',
  explorationMode: 'b17f1a82-0d1e-4bd6-8e53-3ff8447f4012',
  discussionDiver: 'c2a8fe73-2fcb-40d7-9ac3-6d5b91d24013',
  rainyDayQueue: 'd446aa5e-5d65-4316-9f72-7f9f46234014',
  peopleWatcher: 'e9d273aa-6f94-4dc4-89de-0d4c4c5c4015',
  hotTakeMicCheck: 'f1c845ab-7b74-49a0-9c11-12ee7af04016',
  linkDrop: '0ab31fd8-88a1-46d9-9f28-23b1812a4017',
  feedbackLoop: '1bc1eb3d-91f2-44fe-82c3-34d6d3e94018',
  savePoint: '2cd4f6e7-a253-4c90-8a7d-45f0aee84019',
} as const;

const questIdValues = Object.values(questIds)
  .map((id) => `'${id}'`)
  .join(', ');

export class AddAdditionalDailyQuests1773000000000 implements MigrationInterface {
  name = 'AddAdditionalDailyQuests1773000000000';

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
          '${questIds.arenaScout}',
          'The gladiator',
          'Visit the Arena',
          'daily',
          'visit_arena',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.explorationMode}',
          'Adventure time',
          'Visit the Explore page',
          'daily',
          'visit_explore_page',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.discussionDiver}',
          'Open forum',
          'Visit the Discussions page',
          'daily',
          'visit_discussions_page',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.rainyDayQueue}',
          'Dusty cellar',
          'Visit the Read it later page',
          'daily',
          'visit_read_it_later_page',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.peopleWatcher}',
          'Friendly neighbor',
          'View 3 other user profiles',
          'daily',
          'view_user_profile',
          '{"targetCount": 3}',
          true
        ),
        (
          '${questIds.hotTakeMicCheck}',
          'Turn up the heat',
          'Create a hot take',
          'daily',
          'hot_take_create',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.linkDrop}',
          'Link drop',
          'Create a shared link post',
          'daily',
          'post_share',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.feedbackLoop}',
          'Feedback loop',
          'Submit feedback',
          'daily',
          'feedback_submit',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.savePoint}',
          'To the back of the queue',
          'Bookmark 1 post',
          'daily',
          'bookmark_post',
          '{"targetCount": 1}',
          true
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_reward" ("questId", "type", "amount")
      VALUES
        ('${questIds.arenaScout}', 'xp', 10),
        ('${questIds.arenaScout}', 'cores', 5),
        ('${questIds.explorationMode}', 'xp', 10),
        ('${questIds.explorationMode}', 'cores', 5),
        ('${questIds.discussionDiver}', 'xp', 10),
        ('${questIds.discussionDiver}', 'cores', 5),
        ('${questIds.rainyDayQueue}', 'xp', 10),
        ('${questIds.rainyDayQueue}', 'cores', 5),
        ('${questIds.peopleWatcher}', 'xp', 15),
        ('${questIds.peopleWatcher}', 'cores', 5),
        ('${questIds.hotTakeMicCheck}', 'xp', 20),
        ('${questIds.hotTakeMicCheck}', 'cores', 5),
        ('${questIds.linkDrop}', 'xp', 25),
        ('${questIds.linkDrop}', 'cores', 5),
        ('${questIds.feedbackLoop}', 'xp', 20),
        ('${questIds.feedbackLoop}', 'cores', 5),
        ('${questIds.savePoint}', 'xp', 10),
        ('${questIds.savePoint}', 'cores', 5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "quest_reward"
      WHERE "questId" IN (${questIdValues})
    `);

    await queryRunner.query(/* sql */ `
      DELETE FROM "quest"
      WHERE "id" IN (${questIdValues})
    `);
  }
}
