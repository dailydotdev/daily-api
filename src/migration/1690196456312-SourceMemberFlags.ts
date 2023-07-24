import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceMemberFlags1690196456312 implements MigrationInterface {
    name = 'SourceMemberFlags1690196456312'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source_member" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_source_member_userId_flags_showPostsOnFeed" ON source_member ("userId", ((flags->'showPostsOnFeed')::boolean))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_source_member_userId_flags_showPostsOnFeed"`);
        await queryRunner.query(`ALTER TABLE "source_member" DROP COLUMN "flags"`);
    }

}
