import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceUser1750754181052 implements MigrationInterface {
  name = 'SourceUser1750754181052'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" ADD "userId" character varying`);
    await queryRunner.query(`ALTER TABLE "source" ADD CONSTRAINT "UQ_ee6c36f54891cc9dc488a778a2b" UNIQUE ("userId")`);
    await queryRunner.query(`ALTER TABLE "source" ADD CONSTRAINT "FK_source_user_id" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" DROP CONSTRAINT "FK_source_user_id"`);
    await queryRunner.query(`ALTER TABLE "source" DROP CONSTRAINT "UQ_ee6c36f54891cc9dc488a778a2b"`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "userId"`);
  }
}
