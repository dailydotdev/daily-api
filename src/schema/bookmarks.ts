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
import { Bookmark, BookmarkList, Post } from '../entity';
import {
  base64,
  bookmarksFeedBuilder,
  FeedArgs,
  feedResolver,
  getCursorFromAfter,
  isOneValidEmoji,
  Ranking,
} from '../common';
import { In, SelectQueryBuilder } from 'typeorm';
import { GQLPost } from './posts';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { logger } from '../logger';
import { BookmarkListCountLimit, maxBookmarksPerMutation } from '../types';
import graphorm from '../graphorm';
import { BookmarkErrorMessage } from '../errors';

interface GQLAddBookmarkInput {
  postIds: string[];
  listId?: string;
}

export interface GQLBookmark {
  createdAt: Date;
  remindAt: Date;
  list: GQLBookmarkList;
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
    postId: ID!
    list: BookmarkList
    createdAt: DateTime
    remindAt: DateTime

    """
    For backward compatibility with EmptyResponse
    """
    _: Boolean
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

    """
    Optional list ID to add bookmarks to (Plus users only).
    If not provided, Plus users get "last used list" behavior.
    Non-Plus users: this parameter is ignored.
    """
    listId: ID
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
    addBookmarks(data: AddBookmarkInput!): [Bookmark]! @auth

    """
    Add or move bookmark to list
    """
    moveBookmark(id: ID!, listId: ID): EmptyResponse! @auth

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
      Filter bookmarks with reminders only
      """
      reminderOnly: Boolean

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
    Get bookmark list by id
    """
    bookmarkList(id: ID!): BookmarkList! @auth

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
  reminderOnly: boolean;
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
    {
      query,
      unreadOnly,
      reminderOnly,
      listId,
    }: BookmarksArgs & { query: string },
    builder,
    alias,
  ) =>
    bookmarksFeedBuilder({
      ctx,
      unreadOnly,
      reminderOnly,
      listId,
      builder,
      alias,
      query,
    }),
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
      info,
    ): Promise<GQLBookmark[]> => {
      let targetListId: string | null = null;

      if (ctx.isPlus) {
        if (data.listId !== undefined) {
          // If listId is provided, validate it exists and belongs to user
          if (data.listId !== null) {
            await ctx.con
              .getRepository(BookmarkList)
              .findOneByOrFail({ userId: ctx.userId, id: data.listId });
          }
          targetListId = data.listId ?? null;
        } else {
          // Use "last used list" behavior
          const lastAddedBookmark = await ctx.con
            .getRepository(Bookmark)
            .findOne({
              where: { userId: ctx.userId },
              order: { updatedAt: 'DESC' },
              select: ['listId'],
            });
          targetListId = lastAddedBookmark?.listId ?? null;
        }
      }
      // Non-plus users: targetListId stays null, listId param is ignored

      if (data.postIds.length > maxBookmarksPerMutation) {
        throw new ValidationError(BookmarkErrorMessage.EXCEEDS_MUTATION_LIMIT);
      }

      await ctx.con.transaction(async (manager) => {
        const posts = await manager.getRepository(Post).findBy({
          id: In(data.postIds),
        });

        await ctx.con.getRepository(Bookmark).upsert(
          posts.map((post) => ({
            postId: post.id,
            userId: ctx.userId,
            listId: targetListId,
          })),
          ['postId', 'userId'],
        );
      });

      return await graphorm.query<GQLBookmark>(ctx, info, (builder) => ({
        ...builder,
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."postId" IN (:...postIds) AND "${builder.alias}"."userId" = :userId`,
          { postIds: data.postIds, userId: ctx.userId },
        ),
      }));
    },
    moveBookmark: async (
      _,
      { id, listId }: { id: string; listId?: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      if (!ctx.isPlus) {
        throw new ForbiddenError(BookmarkErrorMessage.USER_NOT_PLUS);
      }

      if (listId) {
        await ctx.con
          .getRepository(BookmarkList)
          .findOneByOrFail({ userId: ctx.userId, id: listId });
      }
      await ctx.con.getRepository(Bookmark).update(
        {
          postId: id,
          userId: ctx.userId,
        },
        { listId: listId ?? null },
      );

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
      const isValidIcon = !icon || isOneValidEmoji(icon);
      if (!isValidIcon || !name.length) {
        throw new ValidationError(BookmarkErrorMessage.INVALID_ICON_OR_NAME);
      }
      const maxFoldersCount = ctx.isPlus
        ? BookmarkListCountLimit.Plus
        : BookmarkListCountLimit.Free;
      const userFoldersCount = await ctx.con
        .getRepository(BookmarkList)
        .countBy({ userId: ctx.userId });

      if (userFoldersCount >= maxFoldersCount) {
        if (ctx.isPlus) {
          logger.warn(
            { listCount: userFoldersCount, userId: ctx.userId },
            'bookmark folders limit reached',
          );
        }

        throw new ForbiddenError(
          ctx.isPlus
            ? BookmarkErrorMessage.FOLDER_PLUS_LIMIT_REACHED
            : BookmarkErrorMessage.FOLDER_FREE_LIMIT_REACHED,
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
      if (!ctx.isPlus) {
        throw new ForbiddenError(BookmarkErrorMessage.USER_NOT_PLUS);
      }

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
    bookmarksFeed: async (source, args, ctx: AuthContext, info) => {
      const resolver = feedResolver(
        (
          ctx,
          { unreadOnly, reminderOnly, listId }: BookmarksArgs,
          builder,
          alias,
        ) =>
          bookmarksFeedBuilder({
            ctx,
            unreadOnly,
            reminderOnly,
            listId,
            builder,
            alias,
          }),
        bookmarkPageGenerator,
        applyBookmarkPaging,
        {
          removeHiddenPosts: false,
          removeBannedPosts: false,
          removeNonPublicThresholdSquads: false,
        },
      );

      return resolver(source, args, ctx, info);
    },
    bookmarkList: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLBookmarkList> => {
      if (!ctx.isPlus) {
        throw new ForbiddenError(BookmarkErrorMessage.USER_NOT_PLUS);
      }
      return graphorm.queryOneOrFail<GQLBookmarkList>(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder.where(
            `"${builder.alias}"."id" = :id AND "${builder.alias}"."userId" = :userId`,
            {
              id,
              userId: ctx.userId,
            },
          ),
        }),
        undefined,
        true,
      );
    },
    bookmarkLists: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLBookmarkList[]> => {
      if (!ctx.isPlus) {
        return [];
      }

      return graphorm.query<GQLBookmarkList>(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder
            .where(`"${builder.alias}"."userId" = :userId`, {
              userId: ctx.userId,
            })
            .addOrderBy(`LOWER("${builder.alias}"."name")`, 'ASC'),
        }),
        true,
      );
    },
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
