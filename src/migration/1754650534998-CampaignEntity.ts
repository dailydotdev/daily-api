import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampaignEntity1754650534998 implements MigrationInterface {
  name = 'CampaignEntity1754650534998';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "campaign" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referenceId" text NOT NULL, "userId" character varying NOT NULL, "type" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "endedAt" TIMESTAMP NOT NULL, "state" text NOT NULL, "flags" jsonb NOT NULL DEFAULT '{}', "postId" text, "sourceId" text, CONSTRAINT "PK_0ce34d26e7f2eb316a3a592cdc4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaign_type" ON "campaign" ("type") `,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign" ADD CONSTRAINT "FK_8e2dc400e55e237feba0869bc02" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign" ADD CONSTRAINT "FK_9074c52d57e727dda6591943b10" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign" ADD CONSTRAINT "FK_a8102fd41bef084f19474e97953" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaign_state_created_at_sort" ON "campaign" ((CASE WHEN state = 'active' THEN 0 ELSE 1 END), "createdAt" DESC) `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_campaign_state_created_at_sort"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign" DROP CONSTRAINT "FK_a8102fd41bef084f19474e97953"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign" DROP CONSTRAINT "FK_9074c52d57e727dda6591943b10"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign" DROP CONSTRAINT "FK_8e2dc400e55e237feba0869bc02"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_campaign_type"`);
    await queryRunner.query(`DROP TABLE "campaign"`);
  }
}
