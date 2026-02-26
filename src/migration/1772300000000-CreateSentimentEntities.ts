import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSentimentEntities1772300000000
  implements MigrationInterface
{
  name = 'CreateSentimentEntities1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "sentiment_group" (
        "id" uuid NOT NULL,
        "name" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sentiment_group_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "sentiment_entity" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "groupId" uuid NOT NULL,
        "entity" text NOT NULL,
        "name" text NOT NULL,
        "logo" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sentiment_entity_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX "IDX_sentiment_entity_group_id"
      ON "sentiment_entity" ("groupId")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "sentiment_entity"
      ADD CONSTRAINT "UQ_sentiment_entity_entity" UNIQUE ("entity")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "sentiment_entity"
      ADD CONSTRAINT "FK_sentiment_entity_group_id"
      FOREIGN KEY ("groupId")
      REFERENCES "sentiment_group"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "sentiment_group" ("id", "name")
      VALUES
        ('385404b4-f0f4-4e81-a338-bdca851eca31', 'Coding Agents'),
        ('970ab2c9-f845-4822-82f0-02169713b814', 'LLMs')
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "sentiment_entity" ("groupId", "entity", "name", "logo")
      VALUES
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'cursor',
          'Cursor',
          'https://media.daily.dev/image/upload/s--OaZ4Et3s--/f_auto,q_auto/v1772048234/public/cursor'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'copilot',
          'Copilot',
          'https://media.daily.dev/image/upload/s--giOMGduf--/f_auto,q_auto/v1772048234/public/copilot'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'windsurf',
          'Windsurf',
          'https://media.daily.dev/image/upload/s--yFe4w8pJ--/f_auto,q_auto/v1772048234/public/windsurf'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'cline',
          'Cline',
          'https://media.daily.dev/image/upload/s--36tiYseE--/f_auto,q_auto/v1772048234/public/cline'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'claude_code',
          'Claude Code',
          'https://media.daily.dev/image/upload/s--wo3RJzUi--/f_auto,q_auto/v1772048234/public/claude'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'codex',
          'Codex',
          'https://media.daily.dev/image/upload/s--KxCFSmLf--/f_auto,q_auto/v1772048234/public/openai'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'aider',
          'Aider',
          'https://media.daily.dev/image/upload/s--Kg40cdB4--/f_auto,q_auto/v1772048234/public/aider'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'opencode',
          'OpenCode',
          'https://media.daily.dev/image/upload/s--szFvMrHs--/f_auto,q_auto/v1772048234/public/opencode'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'antigravity',
          'Antigravity',
          'https://media.daily.dev/image/upload/s--5VnOo2GM--/f_auto,q_auto/v1772048234/public/antigravity'
        ),
        (
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          'kilocode',
          'Kilocode',
          'https://media.daily.dev/image/upload/s--8eBUg8m2--/f_auto,q_auto/v1772048234/public/kilocode'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'claude_sonnet',
          'Claude Sonnet',
          'https://media.daily.dev/image/upload/s--wo3RJzUi--/f_auto,q_auto/v1772048234/public/claude'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'claude_opus',
          'Claude Opus',
          'https://media.daily.dev/image/upload/s--wo3RJzUi--/f_auto,q_auto/v1772048234/public/claude'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'gpt_5',
          'GPT-5',
          'https://media.daily.dev/image/upload/s--KxCFSmLf--/f_auto,q_auto/v1772048234/public/openai'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'gpt_codex',
          'GPT Codex',
          'https://media.daily.dev/image/upload/s--KxCFSmLf--/f_auto,q_auto/v1772048234/public/openai'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'deepseek',
          'DeepSeek',
          'https://media.daily.dev/image/upload/s--qf0Ls70z--/f_auto,q_auto/v1772048234/public/deepseek'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'gemini',
          'Gemini',
          'https://media.daily.dev/image/upload/s--2shzqE5e--/f_auto,q_auto/v1772048234/public/gemini'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'llama',
          'Llama',
          'https://media.daily.dev/image/upload/s--ApsuAYre--/f_auto,q_auto/v1772048234/public/llama'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'qwen',
          'Qwen',
          'https://media.daily.dev/image/upload/s--FXxJSTLn--/f_auto,q_auto/v1772048234/public/qwen'
        ),
        (
          '970ab2c9-f845-4822-82f0-02169713b814',
          'kimi',
          'Kimi',
          'https://media.daily.dev/image/upload/s--C_Z9JEzB--/f_auto,q_auto/v1772048234/public/kimi'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "sentiment_entity"
      DROP CONSTRAINT "FK_sentiment_entity_group_id"
    `);
    await queryRunner.query(/* sql */ `
      ALTER TABLE "sentiment_entity"
      DROP CONSTRAINT "UQ_sentiment_entity_entity"
    `);
    await queryRunner.query(`DROP INDEX "public"."IDX_sentiment_entity_group_id"`);
    await queryRunner.query(`DROP TABLE "sentiment_entity"`);
    await queryRunner.query(`DROP TABLE "sentiment_group"`);
  }
}
