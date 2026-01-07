import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialLinksColumn1767795409185 implements MigrationInterface {
  name = 'AddSocialLinksColumn1767795409185';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "socialLinks" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "socialLinks"`);
  }
}
