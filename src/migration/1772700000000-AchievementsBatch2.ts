import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AchievementsBatch21772700000000
  implements MigrationInterface
{
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
          'Referral Count 1',
          'Make 1 referral',
          '',
          'milestone',
          'referral_count',
          '{"targetCount": 1}',
          5
        ),
        (
          'Referral Count 2',
          'Make 10 referrals',
          '',
          'milestone',
          'referral_count',
          '{"targetCount": 10}',
          10
        ),
        (
          'Cores Spent 1',
          'Spend 100 Cores',
          '',
          'milestone',
          'cores_spent',
          '{"targetCount": 100}',
          5
        ),
        (
          'Cores Spent 2',
          'Spend 1000 Cores',
          '',
          'milestone',
          'cores_spent',
          '{"targetCount": 1000}',
          10
        ),
        (
          'Cores Spent 3',
          'Spend 10000 Cores',
          '',
          'milestone',
          'cores_spent',
          '{"targetCount": 10000}',
          25
        ),
        (
          'Poll Post 1',
          'Post a poll',
          '',
          'instant',
          'poll_create',
          '{}',
          5
        ),
        (
          'Company Verified 1',
          'Verify your company email',
          '',
          'instant',
          'company_verified',
          '{}',
          5
        ),
        (
          'Post Impressions 1',
          'Get 1000 post impressions',
          '',
          'milestone',
          'post_impressions',
          '{"targetCount": 1000}',
          5
        ),
        (
          'Post Impressions 2',
          'Get 10000 post impressions',
          '',
          'milestone',
          'post_impressions',
          '{"targetCount": 10000}',
          10
        ),
        (
          'Post Impressions 3',
          'Get 100000 post impressions',
          '',
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
        'Referral Count 1',
        'Referral Count 2',
        'Cores Spent 1',
        'Cores Spent 2',
        'Cores Spent 3',
        'Poll Post 1',
        'Company Verified 1',
        'Post Impressions 1',
        'Post Impressions 2',
        'Post Impressions 3'
      )
    `);
  }
}
