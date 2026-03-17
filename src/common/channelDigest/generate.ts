import {
  SentimentDigestItem,
  SentimentDigestPost,
  SentimentDigestRequest,
} from '@dailydotdev/schema';
import type { DataSource } from 'typeorm';
import { Brackets } from 'typeorm';
import { generateShortId } from '../../ids';
import { getBragiClient } from '../../integrations/bragi/clients';
import { yggdrasilSentimentClient } from '../../integrations/yggdrasil/clients';
import { FreeformPost } from '../../entity/posts/FreeformPost';
import { markdown } from '../markdown';
import { Post, PostOrigin, PostType } from '../../entity/posts/Post';
import {
  PostRelation,
  PostRelationType,
} from '../../entity/posts/PostRelation';
import {
  getChannelDigestLookbackSeconds,
  type ChannelDigestDefinition,
} from './definitions';

type DigestPostRow = {
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

const getDigestWindowStart = async ({
  con,
  now,
  definition,
}: {
  con: DataSource;
  now: Date;
  definition: ChannelDigestDefinition;
}): Promise<Date> => {
  const fallback = new Date(
    now.getTime() - getChannelDigestLookbackSeconds(definition) * 1000,
  );
  const lastDigest = await con.getRepository(FreeformPost).findOne({
    select: {
      id: true,
      createdAt: true,
    },
    where: {
      sourceId: definition.sourceId,
      type: PostType.Freeform,
    },
    order: {
      createdAt: 'DESC',
    },
  });

  if (!lastDigest) {
    return fallback;
  }

  return lastDigest.createdAt > fallback ? lastDigest.createdAt : fallback;
};

const findDigestPosts = async ({
  con,
  from,
  channels,
}: {
  con: DataSource;
  from: Date;
  channels: string[];
}): Promise<DigestPostRow[]> => {
  if (!channels.length) {
    return [];
  }

  return con
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
    .andWhere(
      new Brackets((qb) => {
        channels.forEach((channel, index) => {
          const condition = `(post."contentMeta"->'channels') ? :channel${index}`;
          const params = { [`channel${index}`]: channel };

          if (!index) {
            qb.where(condition, params);
            return;
          }

          qb.orWhere(condition, params);
        });
      }),
    )
    .andWhere('relation."relatedPostId" IS NULL')
    .orderBy('post.createdAt', 'DESC')
    .getRawMany<DigestPostRow>();
};

const findSentimentItems = async ({
  definition,
  from,
  to,
}: {
  definition: ChannelDigestDefinition;
  from: Date;
  to: Date;
}) => {
  if (!definition.includeSentiment || !definition.sentimentGroupIds?.length) {
    return [];
  }

  const responses = await Promise.all(
    definition.sentimentGroupIds.map((groupId) =>
      yggdrasilSentimentClient.getHighlights({
        groupId,
        from: from.toISOString(),
        to: to.toISOString(),
        minHighlightScore: definition.minHighlightScore,
        orderBy: 'recency',
      }),
    ),
  );

  return responses.flatMap((response) => response.items);
};

const buildDigestPosts = ({
  posts,
}: {
  posts: DigestPostRow[];
}): SentimentDigestPost[] =>
  posts.map(
    (post) =>
      new SentimentDigestPost({
        title: post.title || '',
        summary: post.content || post.summary || '',
      }),
  );

const createDigestPost = async ({
  con,
  now,
  sourceId,
  title,
  content,
}: {
  con: DataSource;
  now: Date;
  sourceId: string;
  title: string;
  content: string;
}): Promise<FreeformPost> => {
  const repo = con.getRepository(FreeformPost);
  const postId = await generateShortId();

  return repo.save(
    repo.create({
      id: postId,
      shortId: postId,
      sourceId,
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

export const generateChannelDigest = async ({
  con,
  definition,
  now = new Date(),
}: {
  con: DataSource;
  definition: ChannelDigestDefinition;
  now?: Date;
}): Promise<FreeformPost | null> => {
  const from = await getDigestWindowStart({
    con,
    now,
    definition,
  });
  const [sentimentItems, posts] = await Promise.all([
    findSentimentItems({
      definition,
      from,
      to: now,
    }),
    findDigestPosts({
      con,
      from,
      channels: definition.channels,
    }),
  ]);

  if (!sentimentItems.length && !posts.length) {
    return null;
  }

  const bragiClient = getBragiClient();
  const request = new SentimentDigestRequest({
    date: toDigestDate(now),
    targetAudience: definition.targetAudience,
    frequency: definition.frequency,
    sentimentItems: sentimentItems.map(
      (item) =>
        new SentimentDigestItem({
          text: item.text || '',
          authorHandle: item.author?.handle || '',
          likes: toLikes(item.metrics),
        }),
    ),
    posts: buildDigestPosts({
      posts,
    }),
  });
  const generated = await bragiClient.garmr.execute(() =>
    bragiClient.instance.generateSentimentDigest(request),
  );

  if (!generated.title || !generated.content) {
    throw new Error('bragi digest response is missing title or content');
  }

  return createDigestPost({
    con,
    now,
    sourceId: definition.sourceId,
    title: generated.title,
    content: generated.content,
  });
};
