import {
  TopicalDigest,
  TopicalDigestItem,
  TopicalDigestPost,
  TopicalDigestRequest,
} from '@dailydotdev/schema';
import type { DataSource } from 'typeorm';
import type { ChannelDigest } from '../../entity/ChannelDigest';
import { generateShortId } from '../../ids';
import { getBragiClient } from '../../integrations/bragi/clients';
import { FreeformPost } from '../../entity/posts/FreeformPost';
import { markdown } from '../markdown';
import { Post, PostOrigin, PostType } from '../../entity/posts/Post';
import {
  PostRelation,
  PostRelationType,
} from '../../entity/posts/PostRelation';
import { UNKNOWN_SOURCE } from '../../entity/Source';
import { fetchPublicShareFallbackPostIds } from '../channelHighlight/queries';
import {
  getChannelDigestLookbackSeconds,
  getChannelDigestSourceIds,
} from './definitions';

type DigestPostRow = {
  id: string;
  sourceId: string;
  title: string | null;
  summary: string | null;
  content: string | null;
};

type PreviousDigestPost = Pick<FreeformPost, 'createdAt' | 'content'>;

const digestPostIdsMaxItems = 10;

const toDigestDate = (date: Date): string => date.toISOString().slice(0, 10);

const getPreviousDigestPost = async ({
  con,
  definition,
}: {
  con: DataSource;
  definition: ChannelDigest;
}): Promise<PreviousDigestPost | null> => {
  return con.getRepository(FreeformPost).findOne({
    select: {
      createdAt: true,
      content: true,
    },
    where: {
      sourceId: definition.sourceId,
      type: PostType.Freeform,
    },
    order: {
      createdAt: 'DESC',
    },
  });
};

const getDigestWindowStart = ({
  now,
  definition,
  previousDigest,
}: {
  now: Date;
  definition: ChannelDigest;
  previousDigest: PreviousDigestPost | null;
}): Date => {
  const fallback = new Date(
    now.getTime() - getChannelDigestLookbackSeconds(definition) * 1000,
  );

  if (!previousDigest) {
    return fallback;
  }

  return previousDigest.createdAt > fallback
    ? previousDigest.createdAt
    : fallback;
};

const findDigestPosts = async ({
  con,
  from,
  channel,
  excludedSourceIds,
}: {
  con: DataSource;
  from: Date;
  channel: string;
  excludedSourceIds: string[];
}): Promise<DigestPostRow[]> => {
  if (!channel) {
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
    .select('post.id', 'id')
    .addSelect('post."sourceId"', 'sourceId')
    .addSelect('post.title', 'title')
    .addSelect('post.summary', 'summary')
    .addSelect('post.content', 'content')
    .where('post.createdAt >= :from', { from })
    .andWhere('post.deleted = false')
    .andWhere(`(post."contentMeta"->'channels') ? :channel`, {
      channel,
    })
    .andWhere(
      excludedSourceIds.length
        ? 'post."sourceId" NOT IN (:...excludedSourceIds)'
        : '1=1',
      { excludedSourceIds },
    )
    .andWhere('relation."relatedPostId" IS NULL')
    .orderBy('post.createdAt', 'DESC')
    .getRawMany<DigestPostRow>();
};

const remapUnknownSourcePostIds = async ({
  con,
  posts,
  excludedSourceIds,
}: {
  con: DataSource;
  posts: DigestPostRow[];
  excludedSourceIds: string[];
}): Promise<DigestPostRow[]> => {
  const unknownPostIds = posts
    .filter((post) => post.sourceId === UNKNOWN_SOURCE)
    .map((post) => post.id);

  if (!unknownPostIds.length) {
    return posts;
  }

  const fallbacks = await fetchPublicShareFallbackPostIds({
    con,
    sharedPostIds: unknownPostIds,
    excludedSourceIds,
  });

  const seen = new Set<string>();
  const remapped: DigestPostRow[] = [];

  for (const post of posts) {
    const fallbackId =
      post.sourceId === UNKNOWN_SOURCE ? fallbacks.get(post.id) : undefined;
    const id = fallbackId ?? post.id;

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    remapped.push(fallbackId ? { ...post, id } : post);
  }

  return remapped;
};

const buildDigestPosts = ({
  posts,
}: {
  posts: DigestPostRow[];
}): TopicalDigestPost[] =>
  posts.map(
    (post) =>
      new TopicalDigestPost({
        postId: post.id,
        title: post.title || '',
        summary: post.content || post.summary || '',
      }),
  );

const generateItemLinkMarkdown = ({
  item,
  postIds,
}: {
  item: TopicalDigestItem;
  postIds: Set<string>;
}): string => {
  const itemPostIds = item.postIds
    .filter((postId) => postIds.has(postId))
    .slice(0, digestPostIdsMaxItems);

  if (!itemPostIds.length) {
    return '';
  }

  const readMoreUrl = new URL(process.env.COMMENTS_PREFIX);

  if (itemPostIds.length === 1) {
    readMoreUrl.pathname = `/posts/${itemPostIds[0]}`;
  } else {
    readMoreUrl.pathname = '/feed-by-ids';

    itemPostIds.forEach((postId) => {
      readMoreUrl.searchParams.append('id', postId);
    });
  }

  return ` [Read more](${readMoreUrl.toString()})`;
};

const generateMarkdown = ({
  digest,
  postIds,
}: {
  digest: TopicalDigest;
  postIds: Set<string>;
}): string => {
  const sections: string[] = [`**TLDR:** ${digest.tldr}`];

  if (digest.mainItems.length) {
    sections.push(
      digest.mainItems
        .map(
          (item) =>
            `## ${item.title}\n\n${item.body}${generateItemLinkMarkdown({ item, postIds })}`,
        )
        .join('\n\n'),
    );
  }

  if (digest.alsoNotable.length) {
    sections.push(
      [
        '## Also notable',
        digest.alsoNotable
          .map(
            (item) =>
              `- **${item.title}:** ${item.body}${generateItemLinkMarkdown({ item, postIds })}`,
          )
          .join('\n'),
      ].join('\n\n'),
    );
  }

  return sections.join('\n\n---\n\n').trim();
};

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
  definition: ChannelDigest;
  now?: Date;
}): Promise<FreeformPost | null> => {
  const previousDigest = await getPreviousDigestPost({
    con,
    definition,
  });
  const from = getDigestWindowStart({
    now,
    definition,
    previousDigest,
  });
  const excludedSourceIds = await getChannelDigestSourceIds({
    con,
  });
  const rawPosts = await findDigestPosts({
    con,
    from,
    channel: definition.channel,
    excludedSourceIds,
  });
  const posts = await remapUnknownSourcePostIds({
    con,
    posts: rawPosts,
    excludedSourceIds,
  });

  if (!posts.length) {
    return null;
  }

  const bragiClient = getBragiClient();
  const request = new TopicalDigestRequest({
    date: toDigestDate(now),
    targetAudience: definition.targetAudience,
    frequency: definition.frequency,
    previousDigestMd: previousDigest?.content ?? undefined,
    posts: buildDigestPosts({
      posts,
    }),
  });
  const generated = await bragiClient.garmr.execute(() =>
    bragiClient.instance.generateTopicalDigest(request),
  );

  if (!generated.title || !generated.tldr) {
    throw new Error('bragi digest response is missing title or tldr');
  }

  const postIds = new Set(posts.map((post) => post.id));

  return createDigestPost({
    con,
    now,
    sourceId: definition.sourceId,
    title: generated.title,
    content: generateMarkdown({ digest: generated, postIds }),
  });
};
