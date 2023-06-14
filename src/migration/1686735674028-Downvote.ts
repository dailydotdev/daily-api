import { MigrationInterface, QueryRunner } from "typeorm";

export class Downvote1686735674028 implements MigrationInterface {
    name = 'Downvote1686735674028'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "downvote" ("postId" text NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bcc60336dec1986306e0306b003" PRIMARY KEY ("postId", "userId"))`);
        await queryRunner.query(`ALTER TABLE "downvote" REPLICA IDENTITY FULL`);
        await queryRunner.query(`CREATE INDEX "IDX_267ec54f7b32d8236ecef46070" ON "downvote" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_93db2b31185f4555f43b0b63bb" ON "downvote" ("userId") `);
        await queryRunner.query(`ALTER TABLE "downvote" ADD CONSTRAINT "FK_267ec54f7b32d8236ecef46070c" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "downvote" ADD CONSTRAINT "FK_93db2b31185f4555f43b0b63bb4" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "downvote" DROP CONSTRAINT "FK_93db2b31185f4555f43b0b63bb4"`);
        await queryRunner.query(`ALTER TABLE "downvote" DROP CONSTRAINT "FK_267ec54f7b32d8236ecef46070c"`);
        await queryRunner.query(`DROP TABLE "downvote"`);
    }

}
