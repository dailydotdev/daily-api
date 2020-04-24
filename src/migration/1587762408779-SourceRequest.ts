import {MigrationInterface, QueryRunner} from "typeorm";

export class SourceRequest1587762408779 implements MigrationInterface {
    name = 'SourceRequest1587762408779'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`CREATE TABLE "public"."source_request" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sourceUrl" text NOT NULL, "userId" text NOT NULL, "userName" text, "userEmail" text, "approved" boolean, "closed" boolean NOT NULL DEFAULT false, "sourceId" text, "sourceName" text, "sourceImage" text, "sourceTwitter" text, "sourceFeed" text, "reason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_61844fb1bbef3b7d3e1c8b3edea" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d3873a44af34c69e1fef77ba0b" ON "public"."source_request" ("createdAt", "closed", "approved") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_8ab0b23c8504bc0488d7f18317" ON "public"."source_request" ("createdAt", "closed") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ab0b23c8504bc0488d7f18317"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3873a44af34c69e1fef77ba0b"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."source_request"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
