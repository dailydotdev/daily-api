import {MigrationInterface, QueryRunner} from "typeorm";

export class User1595345916300 implements MigrationInterface {
    name = 'User1595345916300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" DROP CONSTRAINT "FK_b08384d9c394e68429a9eea4df7"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" DROP CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" DROP CONSTRAINT "FK_8c6d05462bc68459e00f165d51c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" DROP CONSTRAINT "FK_72b0f89b884f28444dbae47b340"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_5a7c74084b06b4a08961de754cd"`, undefined);
        await queryRunner.query(`CREATE TABLE "public"."user" ("id" character varying(36) NOT NULL, "name" text NOT NULL, "image" text NOT NULL, CONSTRAINT "PK_03b91d2b8321aa7ba32257dc321" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" ADD CONSTRAINT "FK_b08384d9c394e68429a9eea4df7" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" ADD CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" ADD CONSTRAINT "FK_8c6d05462bc68459e00f165d51c" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" ADD CONSTRAINT "FK_72b0f89b884f28444dbae47b340" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_5a7c74084b06b4a08961de754cd" FOREIGN KEY ("listId") REFERENCES "public"."bookmark_list"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_5a7c74084b06b4a08961de754cd"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" DROP CONSTRAINT "FK_72b0f89b884f28444dbae47b340"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" DROP CONSTRAINT "FK_8c6d05462bc68459e00f165d51c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" DROP CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" DROP CONSTRAINT "FK_b08384d9c394e68429a9eea4df7"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."user"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_5a7c74084b06b4a08961de754cd" FOREIGN KEY ("listId") REFERENCES "public"."bookmark_list"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" ADD CONSTRAINT "FK_72b0f89b884f28444dbae47b340" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_tag" ADD CONSTRAINT "FK_8c6d05462bc68459e00f165d51c" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" ADD CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."feed_source" ADD CONSTRAINT "FK_b08384d9c394e68429a9eea4df7" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
