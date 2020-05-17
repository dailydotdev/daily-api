import {MigrationInterface, QueryRunner} from "typeorm";

export class Bookmark1588088109887 implements MigrationInterface {
    name = 'Bookmark1588088109887'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_96f088a19dec82e82b2551c43bd"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`CREATE TABLE "public"."bookmark" ("postId" text NOT NULL, "userId" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac" PRIMARY KEY ("postId", "userId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b0df46b7939819e8bc14cf9f45" ON "public"."bookmark" ("postId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a56238722b511b0be1ce2ef260" ON "public"."bookmark" ("userId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9ceee09a2d8bb2671f15266e72" ON "public"."bookmark" ("userId", "createdAt") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_96f088a19dec82e82b2551c43bd" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_96f088a19dec82e82b2551c43bd"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ceee09a2d8bb2671f15266e72"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a56238722b511b0be1ce2ef260"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0df46b7939819e8bc14cf9f45"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."bookmark"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_96f088a19dec82e82b2551c43bd" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
