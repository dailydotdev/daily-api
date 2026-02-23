import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotTakeVoteAchievements1771300000000
  implements MigrationInterface {
  name = 'AddHotTakeVoteAchievements1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      INSERT INTO "achievement" (
        "name",
        "description",
        "image",
        "type",
        "eventType",
        "criteria",
        "points"
      )
      VALUES
        (
          'A song of icicles and embers',
          'Swipe on 10 hot takes',
          'https://media.daily.dev/image/upload/s--dV5QOcuy--/q_auto/v1771441474/achievements/That_deck_is_fire',
          'milestone',
          'hot_take_vote',
          '{"targetCount": 20}',
          10
        ),
        (
          'Too hot to handle',
          'Swipe on 100 hot takes',
          'https://media.daily.dev/image/upload/s--KnU2NczW--/q_auto/v1771441474/achievements/Too_hot_to_handle',
          'milestone',
          'hot_take_vote',
          '{"targetCount": 100}',
          25
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "achievement"
      WHERE "eventType" = 'hot_take_vote'
        AND "name" IN ('Hot take voter', 'Hot take power voter')
    `);
  }
}
