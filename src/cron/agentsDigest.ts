import {
  SentimentDigestItem,
  SentimentDigestPost,
  SentimentDigestRequest,
} from '@dailydotdev/schema';
import {
  AGENTS_DIGEST_SOURCE,
  FreeformPost,
  Post,
  PostOrigin,
  PostRelation,
  PostRelationType,
  PostType,
} from '../entity';
import { generateShortId } from '../ids';
import { getBragiClient } from '../integrations/bragi/clients';
import { yggdrasilSentimentClient } from '../integrations/yggdrasil/clients';
import { queryReadReplica } from '../common/queryReadReplica';
import { markdown } from '../common/markdown';
import { Cron } from './cron';

const DIGEST_CHANNEL = 'vibes';
const DIGEST_LOOKBACK_HOURS = 24;
const MIN_HIGHLIGHT_SCORE = 0.65;
const SENTIMENT_GROUP_IDS = [
  '385404b4-f0f4-4e81-a338-bdca851eca31',
  '970ab2c9-f845-4822-82f0-02169713b814',
];

type VibesPostRow = {
  title: string | null;
  summary: string | null;
  content: string | null;
};

const toDigestDate = (date: Date): string => date.toISOString().slice(0, 10);

const toLikes = (
  metrics: {
    like_count?: number;
  } | null,
): number => {
  const raw = metrics?.like_count;
  const likes = typeof raw === 'number' ? raw : Number(raw || 0);
  if (Number.isNaN(likes) || likes < 0) {
    return 0;
  }
  return Math.floor(likes);
};

const findVibesPosts = async ({
  con,
  from,
  channel,
}: {
  con: Parameters<Cron['handler']>[0];
  from: Date;
  channel: string;
}): Promise<VibesPostRow[]> =>
  queryReadReplica(con, async ({ queryRunner }) => {
    return queryRunner.manager
      .getRepository(Post)
      .createQueryBuilder('post')
      .leftJoin(
        PostRelation,
        'relation',
        `relation."relatedPostId" = post.id AND relation.type = :relationType`,
        {
          relationType: PostRelationType.Collection,
        },
      )
      .select('post.title', 'title')
      .addSelect('post.summary', 'summary')
      .addSelect('post.content', 'content')
      .where('post.createdAt >= :from', { from })
      .andWhere('post.deleted = false')
      .andWhere(`(post."contentMeta"->'channels') ? :channel`, { channel })
      .andWhere('relation."relatedPostId" IS NULL')
      .orderBy('post.createdAt', 'DESC')
      .getRawMany<VibesPostRow>();
  });

const createDailyDigestPost = async ({
  con,
  now,
  title,
  content,
}: {
  con: Parameters<Cron['handler']>[0];
  now: Date;
  title: string;
  content: string;
}): Promise<FreeformPost> => {
  const repo = con.getRepository(FreeformPost);
  const postId = await generateShortId();
  return repo.save(
    repo.create({
      id: postId,
      shortId: postId,
      sourceId: AGENTS_DIGEST_SOURCE,
      type: PostType.Freeform,
      title,
      content,
      contentHtml: markdown.render(content),
      visible: true,
      visibleAt: now,
      private: false,
      showOnFeed: true,
      origin: PostOrigin.UserGenerated,
      metadataChangedAt: now,
      flags: {
        visible: true,
        private: false,
        showOnFeed: true,
      },
    }),
  );
};

const cron: Cron = {
  name: 'agents-digest',
  handler: async (con, logger) => {
    const now = new Date();
    const from = new Date(
      now.getTime() - DIGEST_LOOKBACK_HOURS * 60 * 60 * 1000,
    );

    const [highlightResponses, vibesPosts] = await Promise.all([
      Promise.all(
        SENTIMENT_GROUP_IDS.map((groupId) =>
          yggdrasilSentimentClient.getHighlights({
            groupId,
            from: from.toISOString(),
            to: now.toISOString(),
            minHighlightScore: MIN_HIGHLIGHT_SCORE,
            orderBy: 'recency',
          }),
        ),
      ),
      findVibesPosts({
        con,
        from,
        channel: DIGEST_CHANNEL,
      }),
    ]);
    const highlights = highlightResponses.flatMap((response) => response.items);

    if (!highlights.length && !vibesPosts.length) {
      logger.info(
        { from, to: now },
        'agents digest skipped due to empty input',
      );
      return;
    }

    const bragiClient = getBragiClient();
    const generated = await bragiClient.garmr.execute(() =>
      bragiClient.instance.generateSentimentDigest(
        new SentimentDigestRequest({
          date: toDigestDate(now),
          sentimentItems: highlights.map(
            (item) =>
              new SentimentDigestItem({
                text: item.text || '',
                authorHandle: item.author?.handle || '',
                likes: toLikes(item.metrics),
              }),
          ),
          posts: vibesPosts.map(
            (post) =>
              new SentimentDigestPost({
                title: post.title || '',
                summary: post.content || post.summary || '',
              }),
          ),
        }),
      ),
    );

    if (!generated.title || !generated.content) {
      throw new Error('bragi digest response is missing title or content');
    }

    const post = await createDailyDigestPost({
      con,
      now,
      title: generated.title,
      content: generated.content,
    });

    logger.info(
      {
        postId: post.id,
        highlights: highlights.length,
        vibesPosts: vibesPosts.length,
      },
      'agents digest post prepared and sent for yggdrasil processing',
    );
  },
};

export default cron;
