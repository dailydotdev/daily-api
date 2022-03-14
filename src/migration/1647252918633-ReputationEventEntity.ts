import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReputationEventEntity1647252918633 implements MigrationInterface {
  name = 'ReputationEventEntity1647252918633';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reputation_event" ("timestamp" TIMESTAMP NOT NULL DEFAULT now(), "grantById" character varying(36) NOT NULL, "grantToId" character varying(36) NOT NULL, "targetId" character varying(36) NOT NULL, "reason" character varying(36) NOT NULL, "targetType" character varying(36) NOT NULL, "amount" integer NOT NULL, "grantByUserId" character varying(36), "grantToUserId" character varying(36), CONSTRAINT "PK_b0917fad8756e4c202e0855599d" PRIMARY KEY ("timestamp", "grantById", "grantToId", "targetId", "reason", "targetType"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8006ee80f0cdd5dfeb73930a2" ON "reputation_event" ("grantToId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" ADD CONSTRAINT "FK_7580b9d170c6c5668f3bac197f3" FOREIGN KEY ("grantByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" ADD CONSTRAINT "FK_59acef6ae33d0234ca0403e9c7d" FOREIGN KEY ("grantToUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reputation_event" DROP CONSTRAINT "FK_59acef6ae33d0234ca0403e9c7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" DROP CONSTRAINT "FK_7580b9d170c6c5668f3bac197f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8006ee80f0cdd5dfeb73930a2"`,
    );
    await queryRunner.query(`DROP TABLE "reputation_event"`);
  }
}
