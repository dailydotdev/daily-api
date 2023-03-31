import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowMemberPosting1680188261116 implements MigrationInterface {
    name = 'AllowMemberPosting1680188261116'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`ALTER TABLE "source" ADD "allowMemberPosting" boolean DEFAULT true NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "allowMemberPosting"`);
    }

}
