import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketingCta1710235892939 implements MigrationInterface {
    name = 'MarketingCta1710235892939'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "marketing_cta" ("campaignId" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "variant" text NOT NULL, "flags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_28d00a5e83072d15724c50f8520" PRIMARY KEY ("campaignId"))`);
        await queryRunner.query(`CREATE TABLE "user_marketing_cta" ("marketingCtaId" text NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "readAt" TIMESTAMP, CONSTRAINT "PK_e4b378e49cd24e16b8cfa3a523d" PRIMARY KEY ("marketingCtaId", "userId"))`);
        await queryRunner.query(`ALTER TABLE "user_marketing_cta" ADD CONSTRAINT "FK_88a4f0f4851130c210ccb727448" FOREIGN KEY ("marketingCtaId") REFERENCES "marketing_cta"("campaignId") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_marketing_cta" ADD CONSTRAINT "FK_52b027499322daf67dacb8fe368" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_marketing_cta" REPLICA IDENTITY FULL`);
        await queryRunner.query(`ALTER TABLE "marketing_cta" REPLICA IDENTITY FULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "marketing_cta" REPLICA IDENTITY DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_marketing_cta" REPLICA IDENTITY DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_marketing_cta" DROP CONSTRAINT "FK_52b027499322daf67dacb8fe368"`);
        await queryRunner.query(`ALTER TABLE "user_marketing_cta" DROP CONSTRAINT "FK_88a4f0f4851130c210ccb727448"`);
        await queryRunner.query(`DROP TABLE "user_marketing_cta"`);
        await queryRunner.query(`DROP TABLE "marketing_cta"`);
    }
}
