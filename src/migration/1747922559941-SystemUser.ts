import { MigrationInterface, QueryRunner } from 'typeorm';

export class SystemUser1747922559941 implements MigrationInterface {
  name = 'SystemUser1747922559941';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO public.user (id,"name",image,reputation,username,"infoConfirmed","acceptedMarketing",timezone,"notificationEmail",readme,"readmeHtml",flags,"weekStart","followingEmail","followNotifications","subscriptionFlags","cioRegistered","emailConfirmed","coresRole") VALUES ('system','daily.dev system user','https://cdn.daily.dev/assets/maskable_icon.png',0,'system',true,false,'Etc/UTC',false,'Face of the system, [@system](https://app.daily.dev/system).','<p>Face of the system, <a href="https://app.daily.dev/system" target="_blank" rel="noopener nofollow">@system</a>.</p>','{}',1,false,false,'{}',false,true,0) ON CONFLICT (id) DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM public.user WHERE id = 'system'`);
  }
}
