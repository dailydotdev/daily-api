import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPost1691668733329 implements MigrationInterface {
    name = 'UserPost1691668733329'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_post" ("postId" text NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "votedAt" TIMESTAMP, "vote" smallint NOT NULL DEFAULT '0', "hidden" boolean NOT NULL DEFAULT false, "flags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_45cdc90ca0fd4cf0f8e8026e395" PRIMARY KEY ("postId", "userId"))`);
        await queryRunner.query(`ALTER TABLE "user_post" REPLICA IDENTITY FULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_45cdc90ca0fd4cf0f8e8026e39" ON "user_post" ("postId", "userId") `);
        await queryRunner.query(`ALTER TABLE "user_post" ADD CONSTRAINT "FK_3eb8e2db42e1474c4e900b96688" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_post" ADD CONSTRAINT "FK_61c64496bf096b321869175021a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION voted_at_time()
            RETURNS TRIGGER
            LANGUAGE PLPGSQL
            AS
          $$
          BEGIN
            NEW."votedAt" = now();
            RETURN NEW;
          END;
          $$
        `)
        await queryRunner.query('CREATE TRIGGER voted_insert_trigger BEFORE INSERT ON "user_post" FOR EACH ROW WHEN (NEW.vote != 0) EXECUTE PROCEDURE voted_at_time()')
        await queryRunner.query('CREATE TRIGGER voted_update_trigger BEFORE UPDATE ON "user_post" FOR EACH ROW WHEN (OLD.vote IS DISTINCT FROM NEW.vote) EXECUTE PROCEDURE voted_at_time()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TRIGGER IF EXISTS voted_update_trigger ON "user_post"')
        await queryRunner.query('DROP TRIGGER IF EXISTS voted_insert_trigger ON "user_post"')
        await queryRunner.query('DROP FUNCTION IF EXISTS voted_at_time')
        await queryRunner.query(`ALTER TABLE "user_post" DROP CONSTRAINT "FK_61c64496bf096b321869175021a"`);
        await queryRunner.query(`ALTER TABLE "user_post" DROP CONSTRAINT "FK_3eb8e2db42e1474c4e900b96688"`);
        await queryRunner.query(`DROP TABLE "user_post"`);
    }

}
