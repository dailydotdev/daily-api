import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContributionSubmissionReplicaIdentity1782929250551
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contribution_submission" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contribution_submission" REPLICA IDENTITY DEFAULT`,
    );
  }
}
