import { gql, IResolvers } from 'apollo-server-fastify';
import { ConnectionArguments } from 'graphql-relay';
import { SelectQueryBuilder } from 'typeorm';
import {
  forwardPagination,
  PaginationResponse,
  GQLEmptyResponse,
} from './common';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Bookmark, Post } from '../entity';
import { GQLPost } from './posts';

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
    bookmarks: forwardPagination(
      async (
        source,
        { now }: BookmarksArgs,
        ctx,
        { limit, offset },
      ): Promise<PaginationResponse<GQLPost>> => {
        const from = (
          builder: SelectQueryBuilder<Bookmark>,
        ): SelectQueryBuilder<Bookmark> =>
          builder
            .select(['"postId"', '"createdAt"'])
            .addSelect('count(*) OVER() AS count')
            .from(Bookmark, 'bookmark')
            .orderBy('"createdAt"', 'DESC')
            .where('"userId" = :userId')
            .andWhere('"createdAt" <= :now')
            .limit(limit)
            .offset(offset);

        const res = await ctx.con
          .createQueryBuilder()
          .select(['post.*', 'res.count'])
          .from(from, 'res')
          .innerJoin(Post, 'post', 'post.id = res."postId"')
          .setParameters({ userId: ctx.userId, now })
          .orderBy('res."createdAt"', 'DESC')
          .getRawMany();

        return {
          count: parseInt(res[0]?.count || 0),
          nodes: res,
        };
      },
      30,
    ),
  },
});
