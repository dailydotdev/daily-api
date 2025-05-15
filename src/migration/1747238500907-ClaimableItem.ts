import { MigrationInterface, QueryRunner } from "typeorm";

export class ClaimableItem1747238500907 implements MigrationInterface {
    name = 'ClaimableItem1747238500907'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "claimable_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "claimedAt" TIMESTAMP, "type" character varying NOT NULL, "flags" jsonb NOT NULL DEFAULT '{}', "claimedById" character varying, CONSTRAINT "PK_29e58275287423cbbd1dc64469b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_claimable_item_email" ON "claimable_item" ("email") `);
        await queryRunner.query(`ALTER TABLE "claimable_item" ADD CONSTRAINT "FK_a91f7947d5dd4d5567d6a473bf4" FOREIGN KEY ("claimedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "claimable_item" DROP CONSTRAINT "FK_a91f7947d5dd4d5567d6a473bf4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_claimable_item_email"`);
        await queryRunner.query(`DROP TABLE "claimable_item"`);
    }
}
