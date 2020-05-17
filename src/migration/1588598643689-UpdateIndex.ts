import {MigrationInterface, QueryRunner} from "typeorm";

export class UpdateIndex1588598643689 implements MigrationInterface {
    name = 'UpdateIndex1588598643689'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1cf10c73203f7fea3a4061821"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7ae2c768835eb810e23bfe459"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ceee09a2d8bb2671f15266e72"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_createdAt" ON "public"."post" ("createdAt" DESC)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_score" ON "public"."post" ("score" DESC)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bookmark_userId_createdAt" ON "public"."bookmark" ("userId", "createdAt" DESC)`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_post_createdAt"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_post_score"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_bookmark_userId_createdAt"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9ceee09a2d8bb2671f15266e72" ON "public"."bookmark" ("userId", "createdAt") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a7ae2c768835eb810e23bfe459" ON "public"."post" ("score") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b1cf10c73203f7fea3a4061821" ON "public"."post" ("createdAt") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
