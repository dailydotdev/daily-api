import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPostVoteIndex1693903931385 implements MigrationInterface {
    name = 'UserPostVoteIndex1693903931385'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_1d63afaba1fa8e566ec9b62519" ON "user_post" ("userId", "vote", "votedAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1d63afaba1fa8e566ec9b62519"`);
    }

}
