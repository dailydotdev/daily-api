import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReputationEventEntity1650266213744 implements MigrationInterface {
  name = 'ReputationEventEntity1650266213744';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reputation_event" ("grantById" character varying(36) NOT NULL DEFAULT '', "grantToId" character varying(36) NOT NULL, "targetId" character varying(36) NOT NULL, "reason" character varying(36) NOT NULL, "targetType" character varying(36) NOT NULL, "amount" integer NOT NULL, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c8f7531ae536352938ade8c6f97" PRIMARY KEY ("grantById", "grantToId", "targetId", "reason", "targetType"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" ADD CONSTRAINT "FK_f8006ee80f0cdd5dfeb73930a23" FOREIGN KEY ("grantToId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" REPLICA IDENTITY FULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "reputation" SET DEFAULT '10'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "reputation" SET DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_event" DROP CONSTRAINT "FK_f8006ee80f0cdd5dfeb73930a23"`,
    );
    await queryRunner.query(`DROP TABLE "reputation_event"`);
  }
}
