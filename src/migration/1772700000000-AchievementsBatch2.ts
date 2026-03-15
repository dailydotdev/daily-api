import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AchievementsBatch21772700000000 implements MigrationInterface {
  name = 'AchievementsBatch21772700000000';

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
          'My plus one',
          'Successfuly refer one user with your referral link',
          'https://media.daily.dev/image/upload/s--XUoq3jvC--/q_auto/v1773608418/achievements/my_plus_one',
          'milestone',
          'referral_count',
          '{"targetCount": 1}',
          5
        ),
        (
          'Referral spree',
          'Successfully refer 10 users with your referral link',
          'https://media.daily.dev/image/upload/s--h7KVoOJI--/q_auto/v1773608418/achievements/referral_spree',
          'milestone',
          'referral_count',
          '{"targetCount": 10}',
          10
        ),
        (
          'Core values',
          'Spend 100 Cores',
          'https://media.daily.dev/image/upload/s--qkBMxNkZ--/q_auto/v1773608418/achievements/core_value',
          'milestone',
          'cores_spent',
          '{"targetCount": 100}',
          5
        ),
        (
          'Coraholic',
          'Spend 1000 Cores',
          'https://media.daily.dev/image/upload/s--SNnLKKWe--/q_auto/v1773608419/achievements/coraholic',
          'milestone',
          'cores_spent',
          '{"targetCount": 1000}',
          10
        ),
        (
          'Can''t spend it all',
          'Spend 10000 Cores',
          'https://media.daily.dev/image/upload/s--_MjhSTze--/q_auto/v1773608417/achievements/cant_spend_it_all',
          'milestone',
          'cores_spent',
          '{"targetCount": 10000}',
          25
        ),
        (
          'Poll it',
          'Create a poll',
          'https://media.daily.dev/image/upload/s--J20Dc3CL--/q_auto/v1773608418/achievements/poll_it',
          'instant',
          'poll_create',
          '{}',
          5
        ),
        (
          'Verifiably verified',
          'Verify your company email',
          'https://media.daily.dev/image/upload/s--ioFNxPkG--/q_auto/v1773608418/achievements/verifiably_verified',
          'instant',
          'company_verified',
          '{}',
          5
        ),
        (
          'The word around town',
          'Get 1000 post impressions',
          'https://media.daily.dev/image/upload/s--n8pcs3rj--/q_auto/v1773608417/achievements/word_around_town',
          'milestone',
          'post_impressions',
          '{"targetCount": 1000}',
          5
        ),
        (
          'Orator',
          'Get 10000 post impressions',
          'https://media.daily.dev/image/upload/s--RSuQgjxw--/q_auto/v1773609827/achievements/orator',
          'milestone',
          'post_impressions',
          '{"targetCount": 10000}',
          10
        ),
        (
          'Infamous poster',
          'Get 100000 post impressions',
          'https://media.daily.dev/image/upload/s--qe3pqSfV--/q_auto/v1773608419/achievements/infamous_poster',
          'milestone',
          'post_impressions',
          '{"targetCount": 100000}',
          25
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "achievement"
      WHERE "name" IN (
        'My plus one',
        'Referral spree',
        'Core values',
        'Coraholic',
        'Can''t spend it all',
        'Poll it',
        'Verifiably verified',
        'The word around town',
        'Orator',
        'Infamous poster'
      )
    `);
  }
}
