import {MigrationInterface, QueryRunner} from "typeorm";

export class BookmarkIndex1588676028973 implements MigrationInterface {
    name = 'BookmarkIndex1588676028973'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" DROP CONSTRAINT "FK_72b0f89b884f28444dbae47b340"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bookmark_createdAt" ON "public"."bookmark" ("createdAt" DESC)`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" ADD CONSTRAINT "FK_72b0f89b884f28444dbae47b340" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" DROP CONSTRAINT "FK_72b0f89b884f28444dbae47b340"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_bookmark_createdAt"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."hidden_post" ADD CONSTRAINT "FK_72b0f89b884f28444dbae47b340" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
