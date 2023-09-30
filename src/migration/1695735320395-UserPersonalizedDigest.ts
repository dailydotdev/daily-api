import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPersonalizedDigest1695735320395 implements MigrationInterface {
    name = 'UserPersonalizedDigest1695735320395'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_personalized_digest" ("userId" text NOT NULL, "preferredHour" smallint NOT NULL DEFAULT '9', "preferredDay" smallint NOT NULL DEFAULT '1', "preferredTimezone" text NOT NULL DEFAULT 'Etc/UTC', CONSTRAINT "PK_5a85f8949f0533d2bd25ca15ea0" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" REPLICA IDENTITY FULL`);
        await queryRunner.query(`CREATE INDEX "IDX_046c0e003ac6b74dd7c2ee2909" ON "user_personalized_digest" ("preferredDay") `);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD CONSTRAINT "FK_user_personalized_digest_user" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP CONSTRAINT "FK_user_personalized_digest_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_046c0e003ac6b74dd7c2ee2909"`);
        await queryRunner.query(`DROP TABLE "user_personalized_digest"`);
    }

}
