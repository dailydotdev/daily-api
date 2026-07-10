import type { DataSource, EntityManager } from 'typeorm';
import { In, Not } from 'typeorm';
import { randomUUID } from 'crypto';
import { ContentPreferenceKeyword } from '../../entity/contentPreference/ContentPreferenceKeyword';
import { ContentPreferenceSource } from '../../entity/contentPreference/ContentPreferenceSource';
import { ContentPreferenceStatus } from '../../entity/contentPreference/types';
import { ChannelDigest } from '../../entity/ChannelDigest';
import { KeywordChannel } from '../../entity/KeywordChannel';
import { FeedSource } from '../../entity/FeedSource';
import { UserAction, UserActionType } from '../../entity/user/UserAction';
import { SourceMemberRoles } from '../../roles';
import { queryReadReplica } from '../queryReadReplica';
import { remoteConfig } from '../../remoteConfig';
import { getChannelDigestSourceIds } from './definitions';

const defaultHeadlineChannelMinPosts = 10;

// safety cap so seeding never bulk-follows an unbounded number of sources
const maxSeededChannels = 50;

const markBackfilled = async ({
  manager,
  userId,
}: {
  manager: DataSource | EntityManager;
  userId: string;
}): Promise<boolean> => {
  const result = await manager
    .getRepository(UserAction)
    .createQueryBuilder()
    .insert()
    .values({ userId, type: UserActionType.DailyHeadlinesBackfilled })
    .orIgnore()
    .returning(['userId'])
    .execute();

  return result.raw.length > 0;
};

const getUserOnboardingTags = async ({
  con,
  userId,
}: {
  con: DataSource;
  userId: string;
}): Promise<string[]> => {
  const preferences = await con.getRepository(ContentPreferenceKeyword).find({
    select: ['referenceId'],
    where: {
      userId,
      feedId: userId,
      status: Not(ContentPreferenceStatus.Blocked),
    },
  });

  return preferences.map((preference) => preference.referenceId);
};

const resolveHeadlineChannelSourcesForUser = async ({
  con,
  userId,
}: {
  con: DataSource;
  userId: string;
}): Promise<string[]> => {
  const tags = await getUserOnboardingTags({ con, userId });

  if (!tags.length) {
    return [];
  }

  const minPosts =
    remoteConfig.vars.headlineChannelMinPosts ?? defaultHeadlineChannelMinPosts;

  const rows = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager
      .getRepository(KeywordChannel)
      .createQueryBuilder('kc')
      .select('cd."sourceId"', 'sourceId')
      .innerJoin(
        ChannelDigest,
        'cd',
        'cd.enabled = true AND cd.channel = kc.channel',
      )
      .where('kc.keyword IN (:...tags)', { tags })
      .groupBy('cd."sourceId"')
      .having('SUM(kc.posts) >= :minPosts', { minPosts })
      .orderBy('SUM(kc.posts)', 'DESC')
      .limit(maxSeededChannels)
      .getRawMany<{ sourceId: string }>(),
  );

  return rows.map((row) => row.sourceId);
};

export const seedHeadlineChannelsForUser = async ({
  con,
  userId,
}: {
  con: DataSource;
  userId: string;
}): Promise<{ seeded: boolean; sourceIds: string[] }> => {
  const alreadyBackfilled = await con.getRepository(UserAction).exists({
    where: {
      userId,
      type: UserActionType.DailyHeadlinesBackfilled,
    },
  });

  if (alreadyBackfilled) {
    return { seeded: false, sourceIds: [] };
  }

  const digestSourceIds = await getChannelDigestSourceIds({ con });

  if (!digestSourceIds.length) {
    return { seeded: false, sourceIds: [] };
  }

  const hasDigestPreference = await con
    .getRepository(ContentPreferenceSource)
    .exists({
      where: {
        userId,
        feedId: userId,
        referenceId: In(digestSourceIds),
      },
    });

  if (hasDigestPreference) {
    await markBackfilled({ manager: con, userId });
    return { seeded: false, sourceIds: [] };
  }

  const sourceIds = await resolveHeadlineChannelSourcesForUser({
    con,
    userId,
  });

  if (!sourceIds.length) {
    await markBackfilled({ manager: con, userId });
    return { seeded: false, sourceIds: [] };
  }

  return await con.transaction(async (manager) => {
    // claim first: a concurrent first-time call that lost the race bails here
    // instead of writing a second set of follows
    const claimed = await markBackfilled({ manager, userId });

    if (!claimed) {
      return { seeded: false, sourceIds: [] };
    }

    const contentPreferenceRepository = manager.getRepository(
      ContentPreferenceSource,
    );

    await contentPreferenceRepository
      .createQueryBuilder()
      .insert()
      .into(ContentPreferenceSource)
      .values(
        contentPreferenceRepository.create(
          sourceIds.map((sourceId) => ({
            userId,
            referenceId: sourceId,
            sourceId,
            feedId: userId,
            status: ContentPreferenceStatus.Follow,
            flags: {
              referralToken: randomUUID(),
              role: SourceMemberRoles.Member,
            },
          })),
        ),
      )
      .orUpdate(['status'], ['referenceId', 'userId', 'type', 'feedId'])
      .execute();

    await manager
      .createQueryBuilder()
      .insert()
      .into(FeedSource)
      .values(
        sourceIds.map((sourceId) => ({
          feedId: userId,
          sourceId,
          blocked: false,
        })),
      )
      .orUpdate(['blocked'], ['sourceId', 'feedId'])
      .execute();

    return { seeded: true, sourceIds };
  });
};
