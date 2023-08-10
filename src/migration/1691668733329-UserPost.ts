import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPost1691668733329 implements MigrationInterface {
    name = 'UserPost1691668733329'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_post" ("postId" text NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "vote" smallint NOT NULL DEFAULT '0', "hidden" boolean NOT NULL DEFAULT false, "flags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_45cdc90ca0fd4cf0f8e8026e395" PRIMARY KEY ("postId", "userId"))`);
        await queryRunner.query(`ALTER TABLE "user_post" REPLICA IDENTITY FULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_45cdc90ca0fd4cf0f8e8026e39" ON "user_post" ("postId", "userId") `);
        await queryRunner.query(`ALTER TABLE "user_post" ADD CONSTRAINT "FK_3eb8e2db42e1474c4e900b96688" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_post" ADD CONSTRAINT "FK_61c64496bf096b321869175021a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_post" DROP CONSTRAINT "FK_61c64496bf096b321869175021a"`);
        await queryRunner.query(`ALTER TABLE "user_post" DROP CONSTRAINT "FK_3eb8e2db42e1474c4e900b96688"`);
        await queryRunner.query(`DROP TABLE "user_post"`);
    }

}
