import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostScheduledAtFlagIndex1783000000000
  implements MigrationInterface
{
  name = 'PostScheduledAtFlagIndex1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_post_flags_scheduledAt"
        ON "post" ((flags ->> 'scheduledAt'))
        WHERE flags ? 'scheduledAt'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_post_flags_scheduledAt"
    `);
  }
}
