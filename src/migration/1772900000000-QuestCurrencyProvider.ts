import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestCurrencyProvider1772900000000
  implements MigrationInterface
{
  name = 'QuestCurrencyProvider1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO public.user (id,"name",image,reputation,username,"infoConfirmed","acceptedMarketing",timezone,"notificationEmail",readme,"readmeHtml",flags,"weekStart","followingEmail","followNotifications","subscriptionFlags","cioRegistered","emailConfirmed","coresRole") VALUES ('quest','daily.dev quest user','https://cdn.daily.dev/assets/maskable_icon.png',0,'quest',true,false,'Etc/UTC',false,'Face of quests, [@quest](https://app.daily.dev/quest).','<p>Face of quests, <a href="https://app.daily.dev/quest" target="_blank" rel="noopener nofollow">@quest</a>.</p>','{}',1,false,false,'{}',false,true,0) ON CONFLICT (id) DO NOTHING`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_special_user_delete()
      RETURNS trigger AS $$
      BEGIN
        IF OLD.id IN ('404', 'system', 'quest') THEN
          RETURN NULL;
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_special_user_delete()
      RETURNS trigger AS $$
      BEGIN
        IF OLD.id IN ('404', 'system') THEN
          RETURN NULL;
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`DELETE FROM public.user WHERE id = 'quest'`);
  }
}
