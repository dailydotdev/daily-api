import { MigrationInterface, QueryRunner } from "typeorm";

export class ClaimableItem1747010194012 implements MigrationInterface {
    name = 'ClaimableItem1747010194012'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "claimable_item" ("transactionId" character varying NOT NULL, "email" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "claimedAt" TIMESTAMP, "type" character varying NOT NULL, "flags" jsonb NOT NULL DEFAULT '{}', "claimedById" character varying, CONSTRAINT "PK_738cbf01fde094d0da43a1c2c80" PRIMARY KEY ("transactionId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_claimable_item_email" ON "claimable_item" ("email") `);
        await queryRunner.query(`ALTER TABLE "claimable_item" ADD CONSTRAINT "FK_a91f7947d5dd4d5567d6a473bf4" FOREIGN KEY ("claimedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "claimable_item" DROP CONSTRAINT "FK_a91f7947d5dd4d5567d6a473bf4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_claimable_item_email"`);
        await queryRunner.query(`DROP TABLE "claimable_item"`);
    }
}
