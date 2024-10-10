import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferenceFeedKeyword1728563175020
  implements MigrationInterface
{
  name = 'ContentPreferenceFeedKeyword1728563175020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD "keywordId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD "feedId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "FK_bd6dd2c9d5f701352eb6ef256b4" FOREIGN KEY ("keywordId") REFERENCES "keyword"("value") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "FK_1623a286347b83ea1f43d4940e0" FOREIGN KEY ("feedId") REFERENCES "feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "FK_1623a286347b83ea1f43d4940e0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "FK_bd6dd2c9d5f701352eb6ef256b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP COLUMN "feedId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP COLUMN "keywordId"`,
    );
  }
}
