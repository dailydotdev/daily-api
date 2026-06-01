import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostHighlightRetiredAt1774184777236
  implements MigrationInterface
{
  name = 'PostHighlightRetiredAt1774184777236';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        ADD COLUMN "retiredAt" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        DROP COLUMN "retiredAt"
    `);
  }
}
