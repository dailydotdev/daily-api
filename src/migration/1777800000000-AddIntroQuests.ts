import { MigrationInterface, QueryRunner } from 'typeorm';

const questIds = {
  installExtension: 'cf8b49fe-f7c6-4712-909c-9225ae02298a',
  enableNotifications: 'c8598598-e6f7-4f51-b9b4-08c5ed4e11d1',
  generateBrief: '249ec2d6-395f-451d-96c7-5779efaec95e',
  completeProfile: '61c4b3cd-1312-425f-8c12-259a72332ddc',
} as const;

const rotationIds = {
  installExtension: '0720b1b4-5077-442e-ac6f-ee6582d51b8c',
  enableNotifications: '0b0102f8-bc2f-4aa2-ab62-6f5bd22aa18e',
  generateBrief: 'af2a4ba2-d000-488f-9bce-31e2c7963fb7',
  completeProfile: '5614e00a-fd79-4eaa-abc5-ceafea8972ce',
} as const;

const questIdValues = Object.values(questIds)
  .map((id) => `'${id}'`)
  .join(', ');

const introPeriodStart = '2026-03-25 00:00:00';
const introPeriodEnd = '9999-12-31 23:59:59';

export class AddIntroQuests1777800000000 implements MigrationInterface {
  name = 'AddIntroQuests1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      INSERT INTO "quest" (
        "id",
        "name",
        "description",
        "type",
        "eventType",
        "criteria",
        "active"
      )
      VALUES
        (
          '${questIds.installExtension}',
          'Install the browser extension',
          'Make daily.dev your homepage and never miss any updates.',
          'intro',
          'extension_install',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.enableNotifications}',
          'Turn on notifications',
          'Get notified about the things that matter.',
          'intro',
          'notifications_enable',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.generateBrief}',
          'Generate your first brief',
          'Try out the presidential brief feature.',
          'intro',
          'brief_generate',
          '{"targetCount": 1}',
          true
        ),
        (
          '${questIds.completeProfile}',
          'Complete your profile',
          'Complete your profile and increase your visibility.',
          'intro',
          'profile_complete',
          '{"targetCount": 1}',
          true
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_rotation" (
        "id",
        "questId",
        "type",
        "plusOnly",
        "slot",
        "periodStart",
        "periodEnd"
      )
      VALUES
        (
          '${rotationIds.installExtension}',
          '${questIds.installExtension}',
          'intro',
          false,
          1,
          '${introPeriodStart}',
          '${introPeriodEnd}'
        ),
        (
          '${rotationIds.enableNotifications}',
          '${questIds.enableNotifications}',
          'intro',
          false,
          2,
          '${introPeriodStart}',
          '${introPeriodEnd}'
        ),
        (
          '${rotationIds.generateBrief}',
          '${questIds.generateBrief}',
          'intro',
          false,
          3,
          '${introPeriodStart}',
          '${introPeriodEnd}'
        ),
        (
          '${rotationIds.completeProfile}',
          '${questIds.completeProfile}',
          'intro',
          false,
          4,
          '${introPeriodStart}',
          '${introPeriodEnd}'
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_reward" ("questId", "type", "amount")
      VALUES
        ('${questIds.installExtension}', 'xp', 10),
        ('${questIds.installExtension}', 'cores', 5),
        ('${questIds.enableNotifications}', 'xp', 10),
        ('${questIds.enableNotifications}', 'cores', 5),
        ('${questIds.generateBrief}', 'xp', 15),
        ('${questIds.generateBrief}', 'cores', 5),
        ('${questIds.completeProfile}', 'xp', 25),
        ('${questIds.completeProfile}', 'cores', 5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "quest"
      WHERE "id" IN (${questIdValues})
    `);
  }
}
