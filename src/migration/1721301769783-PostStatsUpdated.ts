import { MigrationInterface, QueryRunner } from "typeorm";

export class PostStatsUpdated1721301769783 implements MigrationInterface {
    name = 'PostStatsUpdated1721301769783'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "statsUpdatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "statsUpdatedAt"`);
    }

}
