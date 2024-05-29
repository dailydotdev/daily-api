import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import {
  Keyword,
  KeywordFlagsPublic,
  KeywordStatus,
  PostKeyword,
} from '../entity';
import graphorm from '../graphorm';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { GQLEmptyResponse } from './common';
import { MoreThanOrEqual } from 'typeorm';

export interface GQLKeyword {
  value: string;
  status: KeywordStatus;
  occurrences: number;
  flags?: KeywordFlagsPublic;
  createdAt?: Date;
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

export const typeDefs = /* GraphQL */ `
  type KeywordFlagsPublic {
    """
    Title of the keyword
    """
    title: String

    """
    Description of the keyword
    """
    description: String
  }

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
    """
    The keyword's flags
    """
    flags: KeywordFlagsPublic
    """
    Date when the keyword was created
    """
    createdAt: DateTime
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
    keyword(value: String!): Keyword
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
        where: {
          occurrences: MoreThanOrEqual(PENDING_THRESHOLD),
          status: 'pending',
        },
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
      });
      return { _: true };
    },
  },
});
