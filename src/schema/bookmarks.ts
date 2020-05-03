import { gql, IResolvers } from 'apollo-server-fastify';
import { ConnectionArguments } from 'graphql-relay';
import { GQLEmptyResponse } from './common';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Bookmark } from '../entity';
import { feedResolver } from '../common';

interface GQLAddBookmarkInput {
  postIds: string[];
}

export const typeDefs = gql`
  input AddBookmarkInput {
    """
    Post ids to bookmark
    """
    postIds: [ID!]!
  }

  type Mutation {
    """
    Add new bookmarks
    """
    addBookmarks(data: AddBookmarkInput!): EmptyResponse! @auth

    """
    Remove an existing bookmark
    """
    removeBookmark(id: ID!): EmptyResponse! @auth
  }

  type Query {
    """
    Get the user bookmarks feed
    """
    bookmarks(
      """
      Time the pagination started to ignore new items
      """
      now: DateTime!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): PostConnection! @auth
  }
`;

interface BookmarksArgs extends ConnectionArguments {
  now: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    addBookmarks: async (
      source,
      { data }: { data: GQLAddBookmarkInput },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      const repo = ctx.con.getRepository(Bookmark);
      const values = data.postIds.map((id) =>
        repo.create({
          userId: ctx.userId,
          postId: id,
        }),
      );
      await ctx.con
        .createQueryBuilder()
        .insert()
        .into(Bookmark)
        .values(values)
        .onConflict(`("postId", "userId") DO NOTHING`)
        .execute();
      return { _: true };
    },
    removeBookmark: async (
      source,
      { id }: { id: string },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.getRepository(Bookmark).delete({
        postId: id,
        userId: ctx.userId,
      });
      return { _: true };
    },
  },
  Query: {
    bookmarks: feedResolver((ctx, { now }: BookmarksArgs, builder) =>
      builder
        .innerJoin(Bookmark, 'bookmark', 'bookmark.postId = post.id')
        .where('bookmark.userId = :userId', { userId: ctx.userId })
        .andWhere('bookmark.createdAt <= :now', { now })
        .orderBy('bookmark.createdAt', 'DESC'),
    ),
  },
});
