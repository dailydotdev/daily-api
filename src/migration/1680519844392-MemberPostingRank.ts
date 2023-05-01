import { MigrationInterface, QueryRunner } from "typeorm";

export class MemberPostingRank1680519844392 implements MigrationInterface {
    name = 'MemberPostingRank1680519844392'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" ADD "memberPostingRank" integer DEFAULT 0 NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "memberPostingRank"`);
    }

}
