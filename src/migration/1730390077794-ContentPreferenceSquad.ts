import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferenceSquad1730390077794 implements MigrationInterface {
  name = 'ContentPreferenceSquad1730390077794';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_content_preference_flags_referralToken" ON "content_preference" ((flags->>'referralToken'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_content_preference_flags_referralToken"`,
    );
  }
}
