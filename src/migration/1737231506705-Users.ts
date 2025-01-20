import { MigrationInterface, QueryRunner } from 'typeorm';

export class Users1737231506705 implements MigrationInterface {
  name = 'Users1737231506705';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "bluesky" character varying(100)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_bluesky_unique" ON "user" ("bluesky") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."users_bluesky_unique"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bluesky"`);
  }
}
