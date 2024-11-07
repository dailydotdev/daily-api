import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceModerationIndexes1730992663679 implements MigrationInterface {
    name = 'SourceModerationIndexes1730992663679'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_852c087ea5d00671312fb71c2a" ON "source_post_moderation" ("sourceId", "createdById") `);
        await queryRunner.query(`CREATE INDEX "IDX_532c94738c6b1334e4bc27c41c" ON "source_post_moderation" ("sourceId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_532c94738c6b1334e4bc27c41c"`);
        await queryRunner.query(`DROP INDEX "IDX_852c087ea5d00671312fb71c2a"`);
    }

}
