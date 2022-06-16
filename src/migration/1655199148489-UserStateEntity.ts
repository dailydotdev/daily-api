import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStateEntity1655199148489 implements MigrationInterface {
  name = 'UserStateEntity1655199148489';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_state" ("userId" character varying(36) NOT NULL, "key" character varying NOT NULL, "value" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_da3dddcd66db32a76d0433fca98" PRIMARY KEY ("userId", "key"))`,
    );
    await queryRunner.query(`ALTER TABLE "user_state" REPLICA IDENTITY FULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_state" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(`DROP TABLE "user_state"`);
  }
}
