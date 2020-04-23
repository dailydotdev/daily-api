import {MigrationInterface, QueryRunner} from "typeorm";

export class Source1587658873043 implements MigrationInterface {
    name = 'Source1587658873043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."source_display" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sourceId" text NOT NULL, "name" text NOT NULL, "image" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "userId" text, CONSTRAINT "PK_14ec72a48f111f867492cf70692" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ad5e759962cd86ff322cb480d0" ON "public"."source_display" ("sourceId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4d4ab881c900e50757d4e987fc" ON "public"."source_display" ("userId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_cc6fec511089f9ea5017b15d77" ON "public"."source_display" ("userId", "enabled") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c41a183d0b219907f07efa3e11" ON "public"."source_display" ("sourceId", "userId") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."source_feed" ("sourceId" text NOT NULL, "feed" text NOT NULL, CONSTRAINT "PK_79a0b9f92c1df5ae392af307bda" PRIMARY KEY ("feed"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4f708e773c1df9c288180fbb55" ON "public"."source_feed" ("sourceId") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."source" ("id" text NOT NULL, "twitter" text, "website" text, CONSTRAINT "PK_2f5238e5a67e9c18a3468b4134d" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."source"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f708e773c1df9c288180fbb55"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."source_feed"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_c41a183d0b219907f07efa3e11"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc6fec511089f9ea5017b15d77"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d4ab881c900e50757d4e987fc"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad5e759962cd86ff322cb480d0"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."source_display"`, undefined);
    }

}
