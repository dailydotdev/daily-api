import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStreakActionTimestamp1724764618023
  implements MigrationInterface
{
  name = 'UserStreakActionTimestamp1724764618023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" DROP CONSTRAINT "PK_875298ad33fc69f7d704042cdd4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" ADD CONSTRAINT "PK_9b47cc2282d8546820670783486" PRIMARY KEY ("userId", "type")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" DROP CONSTRAINT "PK_9b47cc2282d8546820670783486"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" ADD CONSTRAINT "PK_875298ad33fc69f7d704042cdd4" PRIMARY KEY ("userId", "type", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" DROP CONSTRAINT "PK_875298ad33fc69f7d704042cdd4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" ADD CONSTRAINT "PK_9b47cc2282d8546820670783486" PRIMARY KEY ("userId", "type")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" DROP CONSTRAINT "PK_9b47cc2282d8546820670783486"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak_action" ADD CONSTRAINT "PK_875298ad33fc69f7d704042cdd4" PRIMARY KEY ("userId", "type", "createdAt")`,
    );
  }
}
