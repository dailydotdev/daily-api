import { MigrationInterface, QueryRunner } from "typeorm";

export class UserReport1736350167538 implements MigrationInterface {
    name = 'UserReport1736350167538'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_report" ("reportedUserId" text NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "reason" character varying(36) NOT NULL, "note" text, CONSTRAINT "PK_f804f389ba2f3ac0313080a1a82" PRIMARY KEY ("reportedUserId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_user_report_reported_user_id" ON "user_report" ("reportedUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_report_user_id" ON "user_report" ("userId") `);
        await queryRunner.query(`ALTER TABLE "user_report" ADD CONSTRAINT "FK_cfc9cf9a552e98d6a634377496f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_report" DROP CONSTRAINT "FK_cfc9cf9a552e98d6a634377496f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_report_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_report_reported_user_id"`);
        await queryRunner.query(`DROP TABLE "user_report"`);
    }

}
