import { MigrationInterface, QueryRunner } from 'typeorm';

export class Prompt1735645895838 implements MigrationInterface {
  name = 'Prompt1735645895838';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "prompt" ("id" text NOT NULL, "order" integer NOT NULL, "label" text NOT NULL, "description" text, "prompt" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "flags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_d8e3aa07a95560a445ad50fb931" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d8e3aa07a95560a445ad50fb93" ON "prompt" ("id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prompt_order" ON "prompt" ("order") `,
    );
    await queryRunner.query(
      `INSERT INTO "public"."prompt" ("id", "order", "label", "description", "prompt", "flags") VALUES
            ('simplify-it', 0, 'Simplify it', 'Break the post down into a simplified explanation of the main ideas using everyday language.', '', '{"icon": "CustomPrompt", "color": "blueCheese"}'),
            ('remove-fluff', 1, 'Remove fluff', 'Get a condensed version of the post, focusing only on the most valuable parts.', '', '{"icon": "CustomPrompt", "color": "ketchup"}'),
            ('challenge-this', 2, 'Challenge this', 'Identify flaws, assumptions, or contrarian viewpoints in the post’s content.', '', '{"icon": "CustomPrompt", "color": "avocado"}'),
            ('practical-examples', 3, 'Practical examples', 'Show practical examples or case studies related to the topic of the post.', '', '{"icon": "CustomPrompt", "color": "onion"}'),
            ('actionable-steps', 4, 'Actionable steps', 'Provide a structured output of steps to implement the content of the post.', '', '{"icon": "CustomPrompt", "color": "water"}'),
            ('skills-needed', 5, 'Skills needed', 'Highlight the skills or prerequisites required to fully understand the post.', '', '{"icon": "CustomPrompt", "color": "lettuce"}'),
            ('compare-alternatives', 6, 'Compare alternatives', 'Analyze similar tools or methods, highlighting their pros and cons.', '', '{"icon": "CustomPrompt", "color": "bun"}'),
            ('extract-code', 7, 'Extract code', 'Pull out all code snippets from the post and display them in one place.', '', '{"icon": "CustomPrompt", "color": "cheese"}'),
            ('custom-prompt', 8, 'Custom prompt', 'Your prompt, your way. Write a custom instruction and run it on the post.', '', '{"icon": "EditPrompt", "color": "bacon"}')
         ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d8e3aa07a95560a445ad50fb93"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_prompt_order"`);
    await queryRunner.query(`DROP TABLE "prompt"`);
  }
}
