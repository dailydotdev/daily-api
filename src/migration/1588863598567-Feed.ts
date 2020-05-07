import {MigrationInterface, QueryRunner} from "typeorm";

export class Feed1588863598567 implements MigrationInterface {
    name = 'Feed1588863598567'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" DROP CONSTRAINT "FK_72b0f89b884f28444dbae47b340"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`CREATE TABLE "public"."feed" ("id" text NOT NULL, "userId" text NOT NULL, CONSTRAINT "PK_d9cdb63413d40e73255025da22f" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_7e1d93d646c13a3a0a2c7e2d5a" ON "public"."feed" ("userId") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."feed_source" ("feedId" text NOT NULL, "sourceId" text NOT NULL, CONSTRAINT "PK_dfe9e35cca8dd23673ea7f5c79d" PRIMARY KEY ("feedId", "sourceId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b08384d9c394e68429a9eea4df" ON "public"."feed_source" ("feedId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a4ead2fdceb9998b4dc4d01935" ON "public"."feed_source" ("sourceId") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."feed_tag" ("feedId" text NOT NULL, "tag" text NOT NULL, CONSTRAINT "PK_58ba71daf2ea16680fa32bdcda4" PRIMARY KEY ("feedId", "tag"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_8c6d05462bc68459e00f165d51" ON "public"."feed_tag" ("feedId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a4b909c4059f55ddaed1e82a8d" ON "public"."feed_tag" ("tag") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" ADD CONSTRAINT "FK_b08384d9c394e68429a9eea4df7" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" ADD CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" ADD CONSTRAINT "FK_8c6d05462bc68459e00f165d51c" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" ADD CONSTRAINT "FK_72b0f89b884f28444dbae47b340" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" DROP CONSTRAINT "FK_72b0f89b884f28444dbae47b340"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" DROP CONSTRAINT "FK_8c6d05462bc68459e00f165d51c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" DROP CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" DROP CONSTRAINT "FK_b08384d9c394e68429a9eea4df7"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4b909c4059f55ddaed1e82a8d"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c6d05462bc68459e00f165d51"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."feed_tag"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4ead2fdceb9998b4dc4d01935"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b08384d9c394e68429a9eea4df"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."feed_source"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e1d93d646c13a3a0a2c7e2d5a"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."feed"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" ADD CONSTRAINT "FK_72b0f89b884f28444dbae47b340" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
