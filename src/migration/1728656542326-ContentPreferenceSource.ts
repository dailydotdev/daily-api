import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferenceSource1728656542326
  implements MigrationInterface
{
  name = 'ContentPreferenceSource1728656542326';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD "sourceId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD "role" text DEFAULT 'member'`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD "flags" jsonb DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "FK_367689a89c5a4e4adeb22d4f0da" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "FK_367689a89c5a4e4adeb22d4f0da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP COLUMN "flags"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP COLUMN "role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP COLUMN "sourceId"`,
    );
  }
}
