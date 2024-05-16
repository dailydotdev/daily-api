import { MigrationInterface, QueryRunner } from "typeorm";

export class SquadPublicRequest1715795499542 implements MigrationInterface {
    name = 'SquadPublicRequest1715795499542'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "squad_public_request" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sourceId" text NOT NULL, "requestorId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "status" text NOT NULL, CONSTRAINT "PK_61c2c7bbc7b36a21c36f1b2f46a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_squad_public_request_sourceId" ON "squad_public_request" ("sourceId") `);
        await queryRunner.query(`ALTER TABLE "squad_public_request" ADD CONSTRAINT "FK_588b9bbf0415aba1e4fed23b8f7" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "squad_public_request" ADD CONSTRAINT "FK_cb822e7eeeb23bf497848d081fb" FOREIGN KEY ("requestorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_squad_public_request_sourceId_status_pending" ON "squad_public_request" ("sourceId", "status") WHERE "status" = 'pending'`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "squad_public_request" DROP CONSTRAINT "FK_cb822e7eeeb23bf497848d081fb"`);
        await queryRunner.query(`ALTER TABLE "squad_public_request" DROP CONSTRAINT "FK_588b9bbf0415aba1e4fed23b8f7"`);
        await queryRunner.query(`DROP INDEX "IDX_squad_public_request_sourceId_status_pending"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_squad_public_request_sourceId"`);
        await queryRunner.query(`DROP TABLE "squad_public_request"`);
    }

}
