import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostBanned1620214912330 implements MigrationInterface {
  name = 'PostBanned1620214912330';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post" ADD "banned" boolean NOT NULL DEFAULT false`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_banned" ON "public"."post" ("banned") `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_banned"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "public"."post" DROP COLUMN "banned"`,
      undefined,
    );
  }
}
