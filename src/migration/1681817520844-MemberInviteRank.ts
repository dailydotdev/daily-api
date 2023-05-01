import { MigrationInterface, QueryRunner } from "typeorm";

export class MemberInviteRank1681817520844 implements MigrationInterface {
    name = 'MemberInviteRank1681817520844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" ADD "memberInviteRank" integer DEFAULT 0 NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "memberInviteRank"`);
    }

}
