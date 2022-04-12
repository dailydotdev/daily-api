import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReputationEventEntity1649760812230 implements MigrationInterface {
  name = 'ReputationEventEntity1649760812230';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reputation_event" ("grantById" character varying(36), "grantToId" character varying(36) NOT NULL, "targetId" character varying(36) NOT NULL, "reason" character varying(36) NOT NULL, "targetType" character varying(36) NOT NULL, "amount" integer NOT NULL, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "grantByUserId" character varying(36), "grantToUserId" character varying(36), CONSTRAINT "PK_e04b1f650b721f68bf76d71b54c" PRIMARY KEY ("grantToId", "targetId", "reason", "targetType"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e89e9f506c292ed295dd1ec36f" ON "reputation_event" ("grantById") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" ADD CONSTRAINT "FK_7580b9d170c6c5668f3bac197f3" FOREIGN KEY ("grantByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" ADD CONSTRAINT "FK_59acef6ae33d0234ca0403e9c7d" FOREIGN KEY ("grantToUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reputation_event" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" DROP CONSTRAINT "FK_59acef6ae33d0234ca0403e9c7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" DROP CONSTRAINT "FK_7580b9d170c6c5668f3bac197f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e89e9f506c292ed295dd1ec36f"`,
    );
    await queryRunner.query(`DROP TABLE "reputation_event"`);
  }
}
