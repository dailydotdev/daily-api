import { MigrationInterface, QueryRunner } from "typeorm";

export class PostFlags1687960180394 implements MigrationInterface {
    name = 'PostFlags1687960180394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_post_flags_sentAnalyticsReport" ON post USING HASH (((flags->'sentAnalyticsReport')::boolean))`);
        await queryRunner.query(`CREATE INDEX "IDX_post_flags_banned" ON post USING HASH (((flags->'banned')::boolean))`);
        await queryRunner.query(`CREATE INDEX "IDX_post_flags_deleted" ON post USING HASH (((flags->'deleted')::boolean))`);
        await queryRunner.query(`CREATE INDEX "IDX_post_flags_promoteToPublic" ON post USING HASH (((flags->'promoteToPublic')::boolean))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_post_flags_sentAnalyticsReport"`);
        await queryRunner.query(`DROP INDEX "IDX_post_flags_banned"`);
        await queryRunner.query(`DROP INDEX "IDX_post_flags_deleted"`);
        await queryRunner.query(`DROP INDEX "IDX_post_flags_promoteToPublic"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "flags"`);
    }

}
