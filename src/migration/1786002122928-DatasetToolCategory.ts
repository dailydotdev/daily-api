import { MigrationInterface, QueryRunner } from 'typeorm';

const CATEGORY_SEED: Record<string, string[]> = {
  Languages: [
    'javascript',
    'typescript',
    'python',
    'go',
    'golang',
    'rust',
    'java',
    'csharp',
    'cplusplus',
    'php',
    'ruby',
    'kotlin',
    'swift',
    'dart',
    'elixir',
    'scala',
  ],
  Frameworks: [
    'react',
    'nextdotjs',
    'vuedotjs',
    'vue',
    'angular',
    'svelte',
    'sveltekit',
    'astro',
    'remix',
    'nuxt',
    'nestjs',
    'express',
    'fastify',
    'django',
    'flask',
    'fastapi',
    'laravel',
    'rubyonrails',
    'springboot',
    'dotnet',
    'flutter',
    'reactnative',
    'tailwindcss',
    'htmx',
  ],
  Databases: [
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'sqlite',
    'supabase',
    'firebase',
    'elasticsearch',
    'clickhouse',
    'mariadb',
    'dynamodb',
    'prisma',
    'drizzle',
  ],
  'Cloud & DevOps': [
    'docker',
    'kubernetes',
    'aws',
    'azure',
    'googlecloud',
    'terraform',
    'vercel',
    'netlify',
    'cloudflare',
    'githubactions',
    'jenkins',
    'ansible',
    'nginx',
    'linux',
    'git',
    'github',
    'gitlab',
  ],
  'AI & ML': [
    'openai',
    'chatgpt',
    'claude',
    'claudecode',
    'copilot',
    'githubcopilot',
    'cursor',
    'ollama',
    'langchain',
    'pytorch',
    'tensorflow',
    'huggingface',
  ],
  'Tools & Editors': [
    'vscode',
    'visualstudiocode',
    'neovim',
    'vim',
    'intellijidea',
    'webstorm',
    'postman',
    'figma',
    'notion',
    'obsidian',
    'jira',
    'slack',
  ],
};

export class DatasetToolCategory1786002122928 implements MigrationInterface {
  name = 'DatasetToolCategory1786002122928';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD COLUMN IF NOT EXISTS "category" text`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_dataset_tool_category" ON "dataset_tool" ("category")`,
    );

    for (const [category, slugs] of Object.entries(CATEGORY_SEED)) {
      await queryRunner.query(
        /* sql */ `UPDATE "dataset_tool" SET "category" = $1 WHERE "titleNormalized" = ANY($2) AND "category" IS NULL`,
        [category, slugs],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_dataset_tool_category"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP COLUMN IF EXISTS "category"`,
    );
  }
}
