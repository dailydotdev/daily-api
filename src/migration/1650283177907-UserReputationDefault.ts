import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserReputationDefault1650283177907 implements MigrationInterface {
  name = 'UserReputationDefault1650283177907';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "reputation" SET DEFAULT '10'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "reputation" SET DEFAULT '1'`,
    );
  }
}
