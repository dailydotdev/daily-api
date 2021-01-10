import { gql, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { Keyword, KeywordStatus, PostKeyword } from '../entity';
import graphorm from '../graphorm';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { GQLEmptyResponse } from './common';
import { EntityManager, MoreThanOrEqual } from 'typeorm';

interface GQLKeyword {
  value: string;
  status: KeywordStatus;
  occurrences: number;
}

interface GQLKeywordSearchResults {
  query: string;
  hits: GQLKeyword[];
}

interface GQLKeywordArgs {
  keyword: string;
}

interface GQLSynonymKeywordArgs {
  keywordToUpdate: string;
  originalKeyword: string;
}

export const typeDefs = gql`
  """
  Post keyword
  """
  type Keyword {
    """
    The keyword itself
    """
    value: String!
    """
    Status of the keyword ('pending' | 'allow' | 'deny' | 'synonym')
    """
    status: String!
    """
    Number of posts containing this keyword
    """
    occurrences: Int!
  }

  """
  Keyword search results
  """
  type KeywordSearchResults {
    """
    Query that was searched
    """
    query: String!
    """
    Search results
    """
    hits: [Keyword]!
  }

  extend type Query {
    """
    Get a random pending keyword
    """
    randomPendingKeyword: Keyword @auth(requires: [MODERATOR])
    """
    Count the number of pending keywords
    """
    countPendingKeywords: Int @auth(requires: [MODERATOR])
    """
    Search in the allowed keywords list
    """
    searchKeywords(query: String!): KeywordSearchResults
      @auth(requires: [MODERATOR])
    """
    Get a keyword
    """
    keyword(value: String!): Keyword @auth(requires: [MODERATOR])
  }

  extend type Mutation {
    """
    Add keyword to the allowlist
    """
    allowKeyword(keyword: String!): EmptyResponse @auth(requires: [MODERATOR])
    """
    Add keyword to the denylist
    """
    denyKeyword(keyword: String!): EmptyResponse @auth(requires: [MODERATOR])
    """
    Set a keyword as a synonym of another keyword
    """
    setKeywordAsSynonym(
      keywordToUpdate: String!
      originalKeyword: String!
    ): EmptyResponse @auth(requires: [MODERATOR])
  }
`;

const PENDING_THRESHOLD = 25;

const updateTagsStrByKeyword = (
  entityManager: EntityManager,
  keyword: string,
): Promise<void> =>
  entityManager.query(
    `update post
          set "tagsStr" = res.tags
          from (
             select pk."postId", array_to_string((array_agg(pk.keyword order by k.occurrences desc, pk.keyword)), ',') as tags
             from post_keyword pk
             inner join keyword k on pk.keyword = k.value and k.status = 'allow'
             group by pk."postId"
          ) as res
          where post.id = res."postId" and exists(select * from post_keyword pk where pk."postId" = post.id and pk.keyword = $1)`,
    [keyword],
  );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    randomPendingKeyword: async (
      source,
      args,
      ctx,
      info,
    ): Promise<GQLKeyword | null> => {
      const res = await graphorm.query<GQLKeyword>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder
          .andWhere(`${builder.alias}.occurrences >= ${PENDING_THRESHOLD}`)
          .andWhere(`${builder.alias}.status = 'pending'`)
          .orderBy(`${builder.alias}.occurrences`, 'DESC')
          .limit(30);
        return builder;
      });
      if (res.length) {
        return res[Math.floor(Math.random() * res.length)];
      }
      return null;
    },
    countPendingKeywords: async (source, args, ctx): Promise<number> => {
      return ctx.con.getRepository(Keyword).count({
        occurrences: MoreThanOrEqual(PENDING_THRESHOLD),
        status: 'pending',
      });
    },
    searchKeywords: async (
      source,
      { query }: { query: string },
      ctx,
      info,
    ): Promise<GQLKeywordSearchResults> => {
      const parsedInfo = parseResolveInfo(info) as ResolveTree;
      const hits = await graphorm.queryResolveTree<GQLKeyword>(
        ctx,
        graphorm.getFieldByHierarchy(parsedInfo, ['hits']),
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere(`${builder.alias}.status = 'allow'`)
            .andWhere(`${builder.alias}.value ILIKE :query`, {
              query: `%${query}%`,
            })
            .orderBy(`${builder.alias}.occurrences`, 'DESC')
            .limit(100);
          return builder;
        },
      );
      return {
        query,
        hits,
      };
    },
    keyword: async (
      source,
      { value }: { value: string },
      ctx,
      info,
    ): Promise<GQLKeyword | null> => {
      const res = await graphorm.query<GQLKeyword>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder
          .andWhere(`${builder.alias}.value = :value`, { value })
          .limit(1);
        return builder;
      });
      return res?.[0] ?? null;
    },
  },
  Mutation: {
    allowKeyword: async (
      source,
      { keyword }: GQLKeywordArgs,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        await entityManager.getRepository(Keyword).save({
          value: keyword,
          status: 'allow',
        });
        await updateTagsStrByKeyword(entityManager, keyword);
      });
      return { _: true };
    },
    denyKeyword: async (
      source,
      { keyword }: GQLKeywordArgs,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        await entityManager.getRepository(Keyword).save({
          value: keyword,
          status: 'deny',
        });
        await updateTagsStrByKeyword(entityManager, keyword);
      });
      return { _: true };
    },
    setKeywordAsSynonym: async (
      source,
      { keywordToUpdate, originalKeyword }: GQLSynonymKeywordArgs,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        const repo = entityManager.getRepository(Keyword);
        await repo.save({
          value: originalKeyword,
          status: 'allow',
        });
        await repo.save({
          value: keywordToUpdate,
          status: 'synonym',
          synonym: originalKeyword,
        });
        await entityManager.query(
          `insert into post_keyword
           select "postId", $1 as keyword
           from post_keyword
           where keyword = $2
           on conflict ("postId", "keyword") do nothing`,
          [originalKeyword, keywordToUpdate],
        );
        await entityManager.delete(PostKeyword, { keyword: keywordToUpdate });
        await updateTagsStrByKeyword(entityManager, originalKeyword);
      });
      return { _: true };
    },
  },
});
