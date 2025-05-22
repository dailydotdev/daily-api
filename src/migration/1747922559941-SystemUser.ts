import { MigrationInterface, QueryRunner } from 'typeorm';

export class SystemUser1747922559941 implements MigrationInterface {
  name = 'SystemUser1747922559941';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO public.user (id,"name",image,reputation,username,twitter,"devcardEligible","createdAt",email,company,title,"infoConfirmed","acceptedMarketing",bio,github,portfolio,hashnode,"updatedAt",timezone,"notificationEmail","referralId","referralOrigin",cover,readme,"readmeHtml","acquisitionChannel","experienceLevel",roadmap,threads,codepen,reddit,stackoverflow,youtube,linkedin,mastodon,flags,"weekStart","language","followingEmail","followNotifications","subscriptionFlags","defaultFeedId","cioRegistered",bluesky,"emailConfirmed","coresRole","awardEmail","awardNotifications") VALUES ('system','daily.dev system user','https://cdn.daily.dev/assets/maskable_icon.png',0,'system',NULL,false,'2025-03-31 12:42:14',NULL,NULL,NULL,true,false,NULL,NULL,NULL,NULL,NULL,'Etc/UTC',false,NULL,NULL,NULL,'Face of the system, [@system](https://app.daily.dev/system).','<p>Face of the system, <a href="https://app.daily.dev/system" target="_blank" rel="noopener nofollow">@system</a>.</p>',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{}',1,NULL,false,false,'{}',NULL,false,NULL,true,0,true,true) ON CONFLICT (id) DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM public.user WHERE id = 'system'`);
  }
}
