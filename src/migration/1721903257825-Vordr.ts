import { MigrationInterface, QueryRunner } from "typeorm";

export class Vordr1721903257825 implements MigrationInterface {
  name = 'Vordr1721903257825'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "flags" jsonb NOT NULL DEFAULT '{"vordr": false}'`);
    await queryRunner.query(`ALTER TABLE "comment" ADD "flags" jsonb NOT NULL DEFAULT '{"vordr": false}'`);

    await queryRunner.query(`CREATE INDEX "IDX_user_flags_vordr" ON post USING HASH (((flags->'vordr')::boolean))`);
    await queryRunner.query(`CREATE INDEX "IDX_comment_flags_vordr" ON post USING HASH (((flags->'vordr')::boolean))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_flags_vordr"`);
    await queryRunner.query(`DROP INDEX "IDX_comment_flags_vordr"`);

    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "flags"`);
    await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "flags"`);
  }
}
