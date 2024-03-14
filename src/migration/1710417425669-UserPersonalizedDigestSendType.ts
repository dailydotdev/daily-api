import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPersonalizedDigestSendType1710417425669 implements MigrationInterface {
    name = 'UserPersonalizedDigestSendType1710417425669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_user_personalized_digest_flags_sendType" ON "user_personalized_digest" ((flags->>'sendType'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_user_personalized_digest_flags_sendType"`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP COLUMN "flags"`);
    }

}
