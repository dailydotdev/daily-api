import { IResolvers } from '@graphql-tools/utils';
import { In } from 'typeorm';
import { BaseContext, Context } from '../Context';
import { ONE_MINUTE_IN_SECONDS } from '../common/constants';
import { queryReadReplica } from '../common/queryReadReplica';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { HighlightsCanonical } from '../entity/HighlightsCanonical';
import { Post, PostType } from '../entity/posts/Post';
import { feedGenerators } from '../integrations/feed/generators';
import { getFeedResponsePostIds } from '../integrations/feed/types';
import { getRedisObject, setRedisObjectWithExpiry } from '../redis';
import {
  applyHighlightsFilters,
  applyVisiblePostFilter,
  majorHeadlineSignificances,
} from './highlights';

export const typeDefs = /* GraphQL */ `
  extend type Query {
    """
    Pre-rendered terminal statusline lines (ANSI styling + OSC 8 hyperlinks)
    for the daily.dev Claude Code plugin: curated major headlines interleaved
    with the popular feed. Rendering lives server-side so content and format
    can change without a plugin release.
    """
    statuslineHeadlines(first: Int): [String!]!
  }
`;

type StatuslineItem = {
  postId: string;
  title: string;
  upvotes: number;
};

const statuslineCacheKey = generateStorageKey(
  StorageTopic.Feed,
  StorageKey.Statusline,
  'global',
);
const statuslineCacheSeconds = 5 * ONE_MINUTE_IN_SECONDS;
const defaultLines = 40;
const maxLines = 60;
const headlinesCount = 10;
const popularCount = 30;
const titleMaxChars = 90;
// Anonymous placeholder so a logged-in caller's preferences never shape the
// globally cached feed-service response.
const statuslineFeedUserId = 'claude-code-statusline';

const ESC = '\u001b';
const styled = (code: string, value: string) =>
  `${ESC}[${code}m${value}${ESC}[0m`;
const hyperlink = (url: string, value: string) =>
  `${ESC}]8;;${url}${ESC}\\${value}${ESC}]8;;${ESC}\\`;

const renderLine = ({ postId, title, upvotes }: StatuslineItem): string => {
  const truncated =
    title.length > titleMaxChars
      ? `${title.slice(0, titleMaxChars - 1)}…`
      : title;
  const url = `${process.env.URL_PREFIX}/c/${postId}?utm_source=claude-code&utm_medium=statusline`;
  const stats = upvotes > 0 ? ` ${styled('2', `▲${upvotes}`)}` : '';
  return `${styled('38;5;135', 'daily.dev')} ${hyperlink(url, styled('1', truncated))}${stats}`;
};

const fetchHeadlines = (ctx: Context): Promise<StatuslineItem[]> =>
  queryReadReplica(ctx.con, ({ queryRunner }) => {
    const builder = queryRunner.manager
      .getRepository(HighlightsCanonical)
      .createQueryBuilder('hc')
      .select('hc."postId"', 'postId')
      .addSelect('hc."headline"', 'title')
      .addSelect('p."upvotes"', 'upvotes')
      .innerJoin(Post, 'p', 'p."id" = hc."postId"')
      .orderBy('hc."highlightedAt"', 'DESC')
      .addOrderBy('hc."id"', 'DESC')
      .limit(headlinesCount);

    return applyVisiblePostFilter(
      applyHighlightsFilters(builder, 'hc', {
        significances: majorHeadlineSignificances,
      }),
      'hc',
    ).getRawMany<StatuslineItem>();
  });

const fetchPopular = async (ctx: Context): Promise<StatuslineItem[]> => {
  const generator = feedGenerators['popular'];
  if (!generator) {
    return [];
  }

  const response = await generator.generate(ctx, {
    user_id: statuslineFeedUserId,
    page_size: popularCount,
    offset: 0,
    allowed_post_types: [
      PostType.Article,
      PostType.Collection,
      PostType.VideoYouTube,
    ],
  });
  const ids = getFeedResponsePostIds(response);
  if (!ids.length) {
    return [];
  }

  const posts = await queryReadReplica(ctx.con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(Post).find({
      select: ['id', 'title', 'upvotes'],
      where: {
        id: In(ids),
        visible: true,
        deleted: false,
        banned: false,
        private: false,
      },
    }),
  );
  const byId = new Map(posts.map((post) => [post.id, post]));

  return ids.flatMap((id) => {
    const post = byId.get(id);
    return post?.title
      ? [{ postId: post.id, title: post.title, upvotes: post.upvotes }]
      : [];
  });
};

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    statuslineHeadlines: async (
      _,
      args: { first?: number | null },
      ctx: Context,
    ): Promise<string[]> => {
      const first = Math.min(args.first || defaultLines, maxLines);
      const cached = await getRedisObject(statuslineCacheKey);
      if (cached) {
        return (JSON.parse(cached) as string[]).slice(0, first);
      }

      // Feeds degrade independently — a feed-service outage still leaves
      // curated headlines on the statusline (and vice versa).
      const [headlines, popular] = (
        await Promise.allSettled([fetchHeadlines(ctx), fetchPopular(ctx)])
      ).map((result) =>
        result.status === 'fulfilled' ? result.value : [],
      ) as [StatuslineItem[], StatuslineItem[]];

      // Interleave curated headlines with popular posts so the rotation
      // alternates flavors; dedupe posts that appear in both feeds.
      const seen = new Set<string>();
      const lines: string[] = [];
      const max = Math.max(headlines.length, popular.length);
      for (let i = 0; i < max; i++) {
        for (const item of [headlines[i], popular[i]]) {
          if (item && !seen.has(item.postId)) {
            seen.add(item.postId);
            lines.push(renderLine(item));
          }
        }
      }

      await setRedisObjectWithExpiry(
        statuslineCacheKey,
        JSON.stringify(lines),
        statuslineCacheSeconds,
      );
      return lines.slice(0, first);
    },
  },
};
