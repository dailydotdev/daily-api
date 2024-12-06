import { IResolvers } from '@graphql-tools/utils';
import { Connection, ConnectionArguments } from 'graphql-relay';
import {
  getSearchQuery,
  GQLEmptyResponse,
  offsetPageGenerator,
  Page,
  PageGenerator,
  processSearchQuery,
} from './common';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import { Bookmark, BookmarkList, Post, User } from '../entity';
import {
  base64,
  bookmarksFeedBuilder,
  FeedArgs,
  feedResolver,
  getCursorFromAfter,
  isOneEmoji,
  Ranking,
} from '../common';
import { SelectQueryBuilder } from 'typeorm';
import { GQLPost } from './posts';
import { isPlusMember, isUserPlusMember } from '../paddle';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { logger } from '../logger';
import { BookmarkListCountLimit } from '../types';
import graphorm from '../graphorm';

interface GQLAddBookmarkInput {
  postIds: string[];
}

export interface GQLBookmarkList {
  id: string;
  name: string;
  icon?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const typeDefs = /* GraphQL */ `
  type BookmarkList {
    """
    Unique identifier
    """
    id: String!

    """
    Name of the list
    """
    name: String!

    """
    Icon of the list
    """
    icon: String

    """
    Date the list was created
    """
    createdAt: DateTime!

    """
    Date the list was last updated
    """
    updatedAt: DateTime!
  }

  type Bookmark {
    createdAt: DateTime
    remindAt: DateTime
    list: BookmarkList
  }

  type SearchBookmarksSuggestion {
    title: String!
  }

  type SearchBookmarksSuggestionsResults {
    query: String!
    hits: [SearchBookmarksSuggestion!]!
  }

  input AddBookmarkInput {
    """
    Post ids to bookmark
    """
    postIds: [ID]!
  }

  type Mutation {
    """
    Set a reminder for a bookmark
    """
    setBookmarkReminder(
      """
      Post id to set reminder for
      """
      postId: ID!
      """
      UTC time to remind at
      """
      remindAt: DateTime
    ): EmptyResponse! @auth

    """
    Add new bookmarks
    """
    addBookmarks(data: AddBookmarkInput!): EmptyResponse! @auth

    """
    Add or move bookmark to list
    """
    addBookmarkToList(id: ID!, listId: ID): EmptyResponse! @auth(premium: true)

    """
    Remove an existing bookmark
    """
    removeBookmark(id: ID!): EmptyResponse! @auth

    """
    Create a new bookmark list
    """
    createBookmarkList(name: String!, icon: String): BookmarkList! @auth

    """
    Remove an existing bookmark list
    """
    removeBookmarkList(id: ID!): EmptyResponse! @auth

    """
    Rename an existing bookmark list
    """
    updateBookmarkList(id: ID!, name: String!, icon: String): BookmarkList!
      @auth
  }

  type Query {
    """
    Get the user bookmarks feed
    """
    bookmarksFeed(
      """
      Time the pagination started to ignore new items
      """
      now: DateTime

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Return only unread posts
      """
      unreadOnly: Boolean = false

      """
      Id of the list to retrieve bookmarks from
      """
      listId: ID

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection! @auth

    """
    Get all the bookmark lists of the user
    """
    bookmarkLists: [BookmarkList!]! @auth

    """
    Get suggestions for search bookmarks query
    """
    searchBookmarksSuggestions(
      """
      The query to search for
      """
      query: String!
    ): SearchBookmarksSuggestionsResults! @auth

    """
    Search through users bookmarks
    """
    searchBookmarks(
      """
      The query to search for
      """
      query: String!

      """
      Time the pagination started to ignore new items
      """
      now: DateTime

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Return only unread posts
      """
      unreadOnly: Boolean = false

      """
      Id of the list to retrieve bookmarks from
      """
      listId: ID

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection! @auth
  }
`;

interface BookmarksArgs extends ConnectionArguments {
  now: Date;
  unreadOnly: boolean;
  listId: string;
  isPlus?: boolean;
  supportedTypes?: string[];
  ranking: Ranking;
}

interface BookmarkPage extends Page {
  limit: number;
  timestamp?: Date;
}

const bookmarkPageGenerator: PageGenerator<
  GQLPost,
  BookmarksArgs,
  BookmarkPage
> = {
  connArgsToPage: ({ first, after }: FeedArgs) => {
    const cursor = getCursorFromAfter(after || undefined);
    const limit = Math.min(first || 30, 50);
    if (cursor) {
      return { limit, timestamp: new Date(parseInt(cursor)) };
    }
    return { limit };
  },
  nodeToCursor: (page, args, node) => {
    return base64(`time:${node.bookmarkedAt!.getTime()}`);
  },
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!page.timestamp,
};

const applyBookmarkPaging = (
  ctx: Context,
  args: unknown,
  page: BookmarkPage,
  builder: SelectQueryBuilder<Post>,
): SelectQueryBuilder<Post> => {
  let newBuilder = builder
    .limit(page.limit)
    .orderBy('bookmark.createdAt', 'DESC');
  if (page.timestamp) {
    newBuilder = newBuilder.andWhere('bookmark."createdAt" < :timestamp', {
      timestamp: page.timestamp,
    });
  }
  return newBuilder;
};

const searchResolver = feedResolver(
  (
    ctx,
    { query, unreadOnly, listId }: BookmarksArgs & { query: string },
    builder,
    alias,
  ) => bookmarksFeedBuilder({ ctx, unreadOnly, listId, builder, alias, query }),
  offsetPageGenerator(30, 50),
  (ctx, args, page, builder) => builder.limit(page.limit).offset(page.offset),
  { removeHiddenPosts: true, removeBannedPosts: false },
);

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Mutation: {
    addBookmarks: async (
      source,
      { data }: { data: GQLAddBookmarkInput },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const [query, params] = ctx.con
        .createQueryBuilder()
        .select('id', 'postId')
        .addSelect(`'${ctx.userId}'`, 'userId')
        .from(Post, 'post')
        .where('post.id IN (:...postIds)', { postIds: data.postIds })
        .getQueryAndParameters();
      await ctx.con.query(
        `insert into bookmark("postId", "userId") ${query} on conflict do nothing`,
        params,
      );
      return { _: true };
    },
    addBookmarkToList: async (
      source,
      { id, listId }: { id: string; listId?: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      if (listId) {
        await ctx.con
          .getRepository(BookmarkList)
          .findOneByOrFail({ userId: ctx.userId, id: listId });
      }
      await ctx.con
        .getRepository(Bookmark)
        .createQueryBuilder()
        .insert()
        .into(Bookmark)
        .values([{ userId: ctx.userId, postId: id, listId }])
        .onConflict(
          `("postId", "userId") DO UPDATE SET "listId" = EXCLUDED."listId"`,
        )
        .execute();
      return { _: true };
    },
    removeBookmark: async (
      source,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.getRepository(Bookmark).delete({
        postId: id,
        userId: ctx.userId,
      });
      return { _: true };
    },
    createBookmarkList: async (
      _,
      { name, icon }: Record<'name' | 'icon', string>,
      ctx: AuthContext,
    ): Promise<GQLBookmarkList> => {
      const isValidIcon = !icon || isOneEmoji(icon);
      if (!isValidIcon || !name.length) {
        throw new ValidationError('Invalid icon or name');
      }

      const user = await ctx.con.getRepository(User).findOneOrFail({
        where: { id: ctx.userId },
        select: ['subscriptionFlags'],
      });
      const isPlus = isPlusMember(user.subscriptionFlags?.cycle);
      const maxFoldersCount = isPlus
        ? BookmarkListCountLimit.Plus
        : BookmarkListCountLimit.Free;
      const userFoldersCount = await ctx.con
        .getRepository(BookmarkList)
        .countBy({ userId: ctx.userId });

      if (userFoldersCount >= maxFoldersCount) {
        if (isPlus) {
          logger.warn(
            { listCount: userFoldersCount, userId: ctx.userId },
            'bookmark folders limit reached',
          );
        }

        throw new ForbiddenError(
          `You have reached the maximum list count (${maxFoldersCount})`,
        );
      }

      return ctx.con.getRepository(BookmarkList).save({
        name,
        icon,
        userId: ctx.userId,
      });
    },
    removeBookmarkList: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.getRepository(BookmarkList).delete({
        id,
        userId: ctx.userId,
      });
      return { _: true };
    },
    updateBookmarkList: async (
      _,
      { id, name, icon }: Record<'id' | 'name' | 'icon', string>,
      ctx: AuthContext,
    ): Promise<GQLBookmarkList> => {
      const repo = ctx.con.getRepository(BookmarkList);
      await repo.findOneByOrFail({ userId: ctx.userId, id });
      return await repo.save({
        userId: ctx.userId,
        id,
        icon,
        name,
      });
    },
    setBookmarkReminder: async (
      source,
      { remindAt, postId }: { remindAt: Date; postId: string },
      { con, userId }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await con.transaction(async (manager) => {
        const repo = manager.getRepository(Bookmark);
        const bookmark = await repo.findOneBy({ userId, postId });

        if (!bookmark) {
          return repo.insert({ userId, postId, remindAt });
        }

        return repo.update({ userId, postId }, { remindAt });
      });

      return { _: true };
    },
  },
  Query: {
    bookmarksFeed: async (source, args, context: AuthContext, info) => {
      const isPlus = await isUserPlusMember(context.con, context.userId);
      const resolver = await feedResolver(
        (ctx, { unreadOnly, listId }: BookmarksArgs, builder, alias) =>
          bookmarksFeedBuilder({
            ctx,
            unreadOnly,
            listId,
            builder,
            alias,
            isPlus,
          }),
        bookmarkPageGenerator,
        applyBookmarkPaging,
        {
          removeHiddenPosts: false,
          removeBannedPosts: false,
          removeNonPublicThresholdSquads: false,
        },
      );

      return resolver(source, args, context, info);
    },
    bookmarkLists: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLBookmarkList[]> =>
      graphorm.query<GQLBookmarkList>(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder.where(
            `"${builder.alias}"."userId" = :userId`,
            {
              userId: ctx.userId,
            },
          ),
        }),
        true,
      ),
    searchBookmarksSuggestions: async (
      source,
      { query }: { query: string },
      ctx: AuthContext,
    ) => {
      const hits: { title: string }[] = await ctx.con.query(
        `
          WITH search AS (${getSearchQuery('$2')})
          select ts_headline(title, search.query,
                             'StartSel = <strong>, StopSel = </strong>') as title
          from post
                 INNER JOIN bookmark ON bookmark."postId" = post.id AND
                                        bookmark."userId" = $1,
               search
          where tsv @@ search.query
          order by views desc
            limit 5;
        `,
        [ctx.userId, processSearchQuery(query)],
      );
      return {
        query,
        hits,
      };
    },
    searchBookmarks: async (
      source,
      args: FeedArgs & BookmarksArgs & { query: string },
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLPost> & { query: string }> => {
      const res = await searchResolver(source, args, ctx, info);
      return {
        ...res,
        query: args.query,
      };
    },
  },
});
