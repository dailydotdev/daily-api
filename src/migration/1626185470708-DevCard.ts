import {MigrationInterface, QueryRunner} from "typeorm";

export class DevCard1626185470708 implements MigrationInterface {
    name = 'DevCard1626185470708'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."dev_card" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "background" text, CONSTRAINT "PK_75df7bf32725a7d931882d3355c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_devcard_userId" ON "public"."dev_card" ("userId") `);
        await queryRunner.query(`ALTER TABLE "public"."dev_card" ADD CONSTRAINT "FK_70a77f197a0f92324256c983fc6" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."dev_card" DROP CONSTRAINT "FK_70a77f197a0f92324256c983fc6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_devcard_userId"`);
        await queryRunner.query(`DROP TABLE "public"."dev_card"`);
    }

}
