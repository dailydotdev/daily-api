import { MigrationInterface, QueryRunner } from "typeorm";

export class UserReferralOrigin1685524779381 implements MigrationInterface {
    name = 'UserReferralOrigin1685524779381'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "referralOrigin" text`);
        await queryRunner.query(`CREATE INDEX "IDX_user_referral_origin" ON "user" ("referralOrigin") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referralOrigin"`);
    }

}
