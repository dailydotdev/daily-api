import type { TypedWorker } from '../worker';
import { UserInterest, UserInterestStatus } from '../../entity/UserInterest';
import { PostKeyword } from '../../entity/PostKeyword';
import { KeywordStatus } from '../../entity/Keyword';
import { FeedTag } from '../../entity/FeedTag';

export const postUpvotedInterestSignalWorker: TypedWorker<'post-upvoted'> = {
  subscription: 'api.post-upvoted-interest-signal',
  handler: async ({ data }, con): Promise<void> => {
    const { postId, userId } = data;

    const keywordRows = await con.getRepository(PostKeyword).find({
      select: ['keyword'],
      where: { postId, status: KeywordStatus.Allow },
    });
    const keywords = keywordRows.map((row) => row.keyword);
    if (!keywords.length) {
      return;
    }

    const interests = await con
      .getRepository(UserInterest)
      .createQueryBuilder('ui')
      .select(['ui.id', 'ui.feedId'])
      .innerJoin(
        FeedTag,
        'ft',
        'ft."feedId" = ui."feedId" AND ft.blocked = false',
      )
      .where('ui.userId = :userId', { userId })
      .andWhere('ui.status = :status', { status: UserInterestStatus.Active })
      .andWhere('ft.tag IN (:...keywords)', { keywords })
      .getMany();

    if (!interests.length) {
      return;
    }

    const values = interests.flatMap((interest) =>
      interest.feedId
        ? keywords.map((tag) => ({ feedId: interest.feedId as string, tag }))
        : [],
    );

    if (values.length) {
      await con
        .getRepository(FeedTag)
        .createQueryBuilder()
        .insert()
        .values(values)
        .orIgnore()
        .execute();
    }
  },
};
