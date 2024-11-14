import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferenceReplicaFull1731424255967
  implements MigrationInterface
{
  name = 'ContentPreferenceReplicaFull1731424255967';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" REPLICA IDENTITY DEFAULT`,
    );
  }
}
