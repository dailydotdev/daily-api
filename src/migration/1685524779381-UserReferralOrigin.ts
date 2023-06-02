import { MigrationInterface, QueryRunner } from "typeorm";

export class UserReferralOrigin1685524779381 implements MigrationInterface {
    name = 'UserReferralOrigin1685524779381'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "referralOrigin" text`);
        await queryRunner.query(`CREATE INDEX "IDX_user_referral_origin" ON "user" ("referralOrigin") `);
        await queryRunner.query(`UPDATE "user" SET "referralOrigin" = 'squad' WHERE "referralId" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referralOrigin"`);
    }

}
