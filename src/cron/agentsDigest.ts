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
  PostType,
  Source,
} from '../entity';
import { generateShortId } from '../ids';
import { getBragiClient } from '../integrations/bragi/clients';
import { yggdrasilSentimentClient } from '../integrations/yggdrasil/clients';
import { notifyContentRequested } from '../common/pubsub';
import { queryReadReplica } from '../common/queryReadReplica';
import { markdown } from '../common/markdown';
import { Cron } from './cron';

const DIGEST_CHANNEL = process.env.AGENTS_DIGEST_CHANNEL || 'vibes';
const DIGEST_LOOKBACK_HOURS = 24;
const DEFAULT_MIN_HIGHLIGHT_SCORE = 0.65;

type VibesPostRow = {
  title: string | null;
  summary: string | null;
};

const toDigestDate = (date: Date): string => date.toISOString().slice(0, 10);

const getGroupId = (): string => {
  const groupId = process.env.AGENTS_DIGEST_SENTIMENT_GROUP_ID;
  if (!groupId) {
    throw new Error('missing AGENTS_DIGEST_SENTIMENT_GROUP_ID');
  }
  return groupId;
};

const getMinHighlightScore = (): number => {
  const raw = process.env.AGENTS_DIGEST_MIN_HIGHLIGHT_SCORE;
  if (!raw) {
    return DEFAULT_MIN_HIGHLIGHT_SCORE;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    return DEFAULT_MIN_HIGHLIGHT_SCORE;
  }

  return parsed;
};

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
      .select('post.title', 'title')
      .addSelect('post.summary', 'summary')
      .where('post.createdAt >= :from', { from })
      .andWhere('post.deleted = false')
      .andWhere('post.type != :collectionType', {
        collectionType: PostType.Collection,
      })
      .andWhere(`(post."contentMeta"->'channels') ? :channel`, { channel })
      .orderBy('post.createdAt', 'DESC')
      .getRawMany<VibesPostRow>();
  });

const upsertDailyDigestPost = async ({
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
  const source = await con.getRepository(Source).findOneBy({
    id: AGENTS_DIGEST_SOURCE,
  });
  if (!source) {
    throw new Error(`source not found: ${AGENTS_DIGEST_SOURCE}`);
  }

  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const repo = con.getRepository(FreeformPost);
  const existing = await repo
    .createQueryBuilder('post')
    .where('post.sourceId = :sourceId', { sourceId: AGENTS_DIGEST_SOURCE })
    .andWhere('post.type = :type', { type: PostType.Freeform })
    .andWhere('post.createdAt >= :dayStart', { dayStart })
    .andWhere('post.createdAt < :dayEnd', { dayEnd })
    .orderBy('post.createdAt', 'DESC')
    .getOne();

  if (existing) {
    existing.title = title;
    existing.content = content;
    existing.contentHtml = markdown.render(content);
    existing.metadataChangedAt = now;
    existing.visible = true;
    existing.showOnFeed = true;
    existing.flags = {
      ...existing.flags,
      visible: true,
      private: source.private,
      showOnFeed: true,
    };
    return repo.save(existing);
  }

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
      private: source.private,
      showOnFeed: true,
      origin: PostOrigin.Crawler,
      score: Math.floor(now.getTime() / (1000 * 60)),
      metadataChangedAt: now,
      flags: {
        visible: true,
        private: source.private,
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

    const highlights = await yggdrasilSentimentClient.getHighlights({
      groupId: getGroupId(),
      from: from.toISOString(),
      to: now.toISOString(),
      minHighlightScore: getMinHighlightScore(),
      orderBy: 'recency',
    });
    const vibesPosts = await findVibesPosts({
      con,
      from,
      channel: DIGEST_CHANNEL,
    });

    if (!highlights.items.length && !vibesPosts.length) {
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
          sentimentItems: highlights.items.map(
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
                summary: post.summary || '',
              }),
          ),
        }),
      ),
    );

    if (!generated.title || !generated.content) {
      throw new Error('bragi digest response is missing title or content');
    }

    const post = await upsertDailyDigestPost({
      con,
      now,
      title: generated.title,
      content: generated.content,
    });

    await notifyContentRequested(logger, {
      id: post.id,
      title: post.title || '',
      content: post.content || '',
      post_type: PostType.Freeform,
    });

    logger.info(
      {
        postId: post.id,
        highlights: highlights.items.length,
        vibesPosts: vibesPosts.length,
      },
      'agents digest post prepared and sent for yggdrasil processing',
    );
  },
};

export default cron;
