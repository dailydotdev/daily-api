import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCoresRole1742566045271 implements MigrationInterface {
  name = 'UserCoresRole1742566045271';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "coresRole" smallint NOT NULL DEFAULT '3'`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_39740d60f36a9779356d6019b2" ON "user" ("coresRole") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_39740d60f36a9779356d6019b2"`,
    );

    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "coresRole"`);
  }
}
