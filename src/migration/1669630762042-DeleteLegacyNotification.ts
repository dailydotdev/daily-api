import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeleteLegacyNotification1669630762042
  implements MigrationInterface
{
  name = 'DeleteLegacyNotification1669630762042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
