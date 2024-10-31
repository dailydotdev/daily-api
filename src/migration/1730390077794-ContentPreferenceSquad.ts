import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferenceSquad1730390077794 implements MigrationInterface {
  name = 'ContentPreferenceSquad1730390077794';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD "referralToken" text`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ae47f6c65e5835c5a104974aa3" ON "content_preference" ("referralToken") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae47f6c65e5835c5a104974aa3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP COLUMN "referralToken"`,
    );
  }
}
