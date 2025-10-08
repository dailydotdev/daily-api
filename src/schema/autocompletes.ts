import { Keyword, KeywordStatus } from '../entity';
import { AutocompleteType, Autocomplete } from '../entity/Autocomplete';
import { traceResolvers } from './trace';
import { ILike } from 'typeorm';
import { AuthContext, BaseContext } from '../Context';
import { toGQLEnum } from '../common';
import { queryReadReplica } from '../common/queryReadReplica';
import {
  autocompleteBaseSchema,
  autocompleteSchema,
} from '../common/schema/autocompletes';
import type z from 'zod';

interface AutocompleteData {
  result: string[];
}

interface GQLKeywordAutocomplete {
  keyword: string;
  title: string | null;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(AutocompleteType, 'AutocompleteType')}

  type AutocompleteData {
    result: [String]!
  }

  type KeywordAutocomplete {
    keyword: String!
    title: String
  }

  extend type Query {
    """
    Get autocomplete based on type
    """
    autocomplete(type: AutocompleteType!, query: String!): AutocompleteData!
      @auth
      @cacheControl(maxAge: 3600)

    autocompleteKeywords(
      query: String!
      limit: Int = 20
    ): [KeywordAutocomplete!]! @cacheControl(maxAge: 3600)
  }
`;

export const resolvers = traceResolvers<unknown, BaseContext>({
  Query: {
    autocomplete: async (
      _,
      payload: z.infer<typeof autocompleteSchema>,
      ctx: AuthContext,
    ): Promise<AutocompleteData> => {
      const { type, query, limit } = autocompleteSchema.parse(payload);
      const result = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(Autocomplete).find({
          select: { value: true },
          take: limit,
          order: { value: 'ASC' },
          where: { enabled: true, type, value: ILike(`%${query}%`) },
        }),
      );

      return { result: result.map((a) => a.value) };
    },
    autocompleteKeywords: async (
      _,
      payload: z.infer<typeof autocompleteBaseSchema>,
      ctx: AuthContext,
    ): Promise<GQLKeywordAutocomplete[]> => {
      const data = autocompleteBaseSchema.parse(payload);

      const status = !!ctx.userId
        ? [KeywordStatus.Allow, KeywordStatus.Synonym]
        : [KeywordStatus.Allow];

      return queryReadReplica(ctx.con, async ({ queryRunner }) =>
        queryRunner.manager
          .createQueryBuilder()
          .select('k.value', 'keyword')
          .addSelect(`COALESCE(k.flags->>'title', NULL)`, 'title')
          .from(Keyword, 'k')
          .where('k.status IN (:...status)', {
            status: status,
          })
          .andWhere('k.value ILIKE :query', { query: `%${data.query}%` })
          .orderBy(`(k.status <> '${KeywordStatus.Allow}')`, 'ASC')
          .addOrderBy('k.occurrences', 'DESC')
          .addOrderBy('k.value', 'ASC')
          .limit(data.limit)
          .getRawMany<{ keyword: string; title: string | null }>(),
      );
    },
  },
});
