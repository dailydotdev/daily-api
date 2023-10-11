import {MigrationInterface, QueryRunner} from "typeorm";

export class IndexEmail1696520516809 implements MigrationInterface {
  name = 'IndexEmail1696520516809'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_user_email" ON "user" ("email") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_email"`);
  }

}
