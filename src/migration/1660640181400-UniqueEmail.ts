import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueEmailHandles1660640181400 implements MigrationInterface {
  name = 'UniqueEmailHandles1660640181400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_unique" ON "user" ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."users_email_unique"`);
  }
}
