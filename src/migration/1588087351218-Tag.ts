import {MigrationInterface, QueryRunner} from "typeorm";

export class Tag1588087351218 implements MigrationInterface {
    name = 'Tag1588087351218'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_96f088a19dec82e82b2551c43bd"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c"`, undefined);
        await queryRunner.query(`CREATE TABLE "public"."post_tag" ("postId" text NOT NULL, "tag" text NOT NULL, CONSTRAINT "PK_9363b3518b38d491a01d426bfda" PRIMARY KEY ("postId", "tag"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_f3c0b831daae119196482c9937" ON "public"."post_tag" ("postId") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."tag_count" ("tag" text NOT NULL, "count" integer NOT NULL, CONSTRAINT "PK_c38d6220093832e3affc929f1fd" PRIMARY KEY ("tag"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9bfb14c3ca97adcf27ad3e6637" ON "public"."tag_count" ("count") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_96f088a19dec82e82b2551c43bd" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_96f088a19dec82e82b2551c43bd"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9bfb14c3ca97adcf27ad3e6637"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."tag_count"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3c0b831daae119196482c9937"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."post_tag"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_96f088a19dec82e82b2551c43bd" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
