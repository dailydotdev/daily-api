import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostYggdrasilId1690963996461 implements MigrationInterface {
  name = 'PostYggdrasilId1690963996461';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "yggdrasilId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_yggdrasil_id" ON "post" ("yggdrasilId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_yggdrasil_id"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "yggdrasilId"`);
  }
}
