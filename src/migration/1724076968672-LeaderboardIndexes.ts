import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaderboardIndexes1724076968672 implements MigrationInterface {
  name = 'LeaderboardIndexes1724076968672';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      `CREATE INDEX IDX_user_streak_currentStreak_userId ON public.user_streak ("currentStreak" DESC, "userId" ASC)`,
    );
    queryRunner.query(
      `CREATE INDEX IDX_user_streak_totalStreak_userId ON public.user_streak ("totalStreak" DESC, "userId" ASC)`,
    );
    queryRunner.query(
      `CREATE INDEX IDX_user_reputation ON public.user ("reputation" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`DROP INDEX IDX_user_reputation`);
    queryRunner.query(`DROP INDEX IDX_user_streak_totalStreak_userId`);
    queryRunner.query(
      `DROP INDEX IDX_user_streak_currentStreak_userId`,
    );
  }
}
