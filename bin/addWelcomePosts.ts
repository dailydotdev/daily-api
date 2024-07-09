import createOrGetConnection from '../src/db';
import { SourceMember, SquadSource } from '../src/entity';
import { SourceMemberRoles } from '../src/roles';
import { createSquadWelcomePost } from '../src/common';

(async (): Promise<void> => {
  const con = await createOrGetConnection();

  const queryRunner = con.createQueryRunner();
  await queryRunner.connect();
  const resStream = await queryRunner.stream(
    `select * from source where not exists (select null from post where post."sourceId" = source.id and post."type" = 'welcome') and source."type" = 'squad'`,
  );

  resStream.on('data', async (squadSource: SquadSource) => {
    // Fetch first admin based on created data
    const { userId } = await con.getRepository(SourceMember).findOneOrFail({
      where: { sourceId: squadSource.id, role: SourceMemberRoles.Admin },
      order: { createdAt: 'ASC' },
    });
    if (!userId) {
      console.log(`Squad ${squadSource.id} has no owner`);
      return;
    }
    // Execute createWelcomePost
    await createSquadWelcomePost(con, squadSource, userId);
  });

  await new Promise((resolve, reject) => {
    resStream.on('error', reject);
    resStream.on('end', resolve);
  });
})();
