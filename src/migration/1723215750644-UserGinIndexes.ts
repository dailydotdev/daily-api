import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserGinIndexes1723215750644 implements MigrationInterface {
  name = 'UserGinIndexes1723215750644';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IDX_user_gin_username ON "user" USING GIN ("username" gin_trgm_ops)`);
    await queryRunner.query(`
      CREATE INDEX IDX_user_gin_name ON "user" USING GIN ("name" gin_trgm_ops)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_gin_username"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_gin_name"`);
  }
}
