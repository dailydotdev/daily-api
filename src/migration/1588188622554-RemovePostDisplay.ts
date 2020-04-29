import {MigrationInterface, QueryRunner} from "typeorm";

export class RemovePostDisplay1588188622554 implements MigrationInterface {
    name = 'RemovePostDisplay1588188622554'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "sourceId" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "url" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "canonicalUrl" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "title" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "image" text`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "ratio" double precision`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "placeholder" text`, undefined);
        await queryRunner.query(`DROP TABLE "public"."post_display"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_83c8ae07417cd6de65b8b99458" ON "public"."post" ("sourceId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bd2cd5fdf6699875f262747372" ON "public"."post" ("url") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_fb99ad6d900513655fd0882435" ON "public"."post" ("canonicalUrl") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb99ad6d900513655fd0882435"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd2cd5fdf6699875f262747372"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_83c8ae07417cd6de65b8b99458"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "placeholder"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "ratio"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "image"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "title"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "canonicalUrl"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "url"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "sourceId"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
