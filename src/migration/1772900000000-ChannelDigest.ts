import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelDigest1772900000000 implements MigrationInterface {
  name = 'ChannelDigest1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "channel_digest" (
        "key" text NOT NULL,
        "sourceId" text NOT NULL,
        "channel" text NOT NULL,
        "targetAudience" text NOT NULL,
        "frequency" text NOT NULL,
        "includeSentiment" boolean NOT NULL DEFAULT false,
        "minHighlightScore" real,
        "sentimentGroupIds" text array NOT NULL DEFAULT '{}',
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_digest_key"
          PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_channel_digest_sourceId"
        ON "channel_digest" ("sourceId")
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "channel_digest" (
        "key",
        "sourceId",
        "channel",
        "targetAudience",
        "frequency",
        "includeSentiment",
        "minHighlightScore",
        "sentimentGroupIds"
      )
      VALUES
      (
        'agentic',
        'agents_digest',
        'vibes',
        'software engineers and engineering leaders who care about AI tooling, agentic engineering, models, and vibe coding. They range from vibe coders to seasoned engineers tracking how AI is reshaping their craft.',
        'daily',
        true,
        0.65,
        ARRAY[
        '385404b4-f0f4-4e81-a338-bdca851eca31',
        '970ab2c9-f845-4822-82f0-02169713b814'
        ]::text[]
      ),
          (
            'webdev',
            'webdev_digest',
            'webdev',
            'frontend and full-stack developers working with frameworks like React, Vue, Angular, or Svelte who follow CSS, accessibility, and web standards.',
            'daily',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'backend',
            'backend_digest',
            'backend',
            'backend developers and software architects working on server-side systems, microservices, API design, and distributed infrastructure.',
            'daily',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'databases',
            'databases_digest',
            'databases',
            'backend developers and data engineers who work directly with databases, query performance, indexing, and data modeling.',
            'daily',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'career',
            'career_digest',
            'career',
            'developers and engineering managers interested in career development, hiring, remote work, leadership, and team culture.',
            'weekly',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'golang',
            'golang_digest',
            'golang',
            'Go developers building services, CLIs, and infrastructure tooling at any experience level.',
            'weekly',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'rust',
            'rust_digest',
            'rust',
            'Rust developers and systems programmers working on performance-critical software, networking, or WebAssembly.',
            'weekly',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'opensource',
            'opensource_digest',
            'opensource',
            'open source contributors, Linux users, and anyone following FOSS project releases and community developments.',
            'weekly',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'testing',
            'testing_digest',
            'testing',
            'developers and QA engineers working on test automation, CI/CD, and software quality with tools like Playwright and Cypress.',
            'weekly',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'php',
            'php_digest',
            'php',
            'PHP developers building with Laravel, WordPress, or Symfony who follow framework and package releases.',
            'weekly',
            false,
            NULL,
            '{}'::text[]
          ),
          (
            'java',
            'java_digest',
            'java',
            'Java developers working with Spring Boot and the JVM ecosystem, from enterprise services to modern Java features.',
            'weekly',
            false,
            NULL,
            '{}'::text[]
          )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "channel_digest"
    `);
  }
}
