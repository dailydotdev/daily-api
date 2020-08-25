import {MigrationInterface, QueryRunner} from "typeorm";

export class SourceFeedLastFetched1598351006459 implements MigrationInterface {
    name = 'SourceFeedLastFetched1598351006459'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD "lastFetched" TIMESTAMP`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP COLUMN "lastFetched"`, undefined);
    }

}
