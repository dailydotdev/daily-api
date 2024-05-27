import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadPublicRequestReplica1716379554138
  implements MigrationInterface
{
  name = 'SquadPublicRequestReplica1716379554138';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."squad_public_request" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."squad_public_request" REPLICA IDENTITY DEFAULT`,
    );
  }
}
