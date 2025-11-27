import { Keyword, KeywordStatus } from '../entity';
import { AutocompleteType, Autocomplete } from '../entity/Autocomplete';
import { traceResolvers } from './trace';
import { ILike, Raw } from 'typeorm';
import { AuthContext, BaseContext } from '../Context';
import { textToSlug, toGQLEnum, type GQLCompany } from '../common';
import { queryReadReplica } from '../common/queryReadReplica';
import {
  autocompleteBaseSchema,
  autocompleteCompanySchema,
  autocompleteKeywordsSchema,
  autocompleteSchema,
} from '../common/schema/autocompletes';
import type z from 'zod';
import { Company, CompanyType } from '../entity/Company';
import { mapboxClient } from '../integrations/mapbox/clients';

interface AutocompleteData {
  result: string[];
}

interface GQLKeywordAutocomplete {
  keyword: string;
  title: string | null;
}

interface GQLLocation {
  id: string;
  country: string;
  city: string | null;
  subdivision: string | null;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(AutocompleteType, 'AutocompleteType')}
  ${toGQLEnum(CompanyType, 'CompanyType')}

  type AutocompleteData {
    result: [String]!
  }

  type KeywordAutocomplete {
    keyword: String!
    title: String
  }

  type Location {
    id: ID!
    country: String
    city: String
    subdivision: String
  }

  extend type Query {
    """
    Get autocomplete based on type
    """
    autocomplete(type: AutocompleteType!, query: String!): AutocompleteData!
      @auth
      @cacheControl(maxAge: 3600)

    """
    Get autocomplete based on type
    """
    autocompleteLocation(query: String!): [Location]!
      @auth
      @cacheControl(maxAge: 3600)

    autocompleteKeywords(
      query: String!
      limit: Int = 20
    ): [KeywordAutocomplete!]! @cacheControl(maxAge: 3600)

    autocompleteCompany(
      query: String!
      limit: Int
      type: CompanyType
    ): [Company]! @cacheControl(maxAge: 3600)
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
          where: [
            { enabled: true, type, slug: textToSlug(query) },
            { enabled: true, type, value: ILike(`%${query}%`) },
          ],
        }),
      );

      return { result: result.map((a) => a.value) };
    },
    autocompleteLocation: async (
      _,
      payload: z.infer<typeof autocompleteSchema>,
    ): Promise<GQLLocation[]> => {
      const { query } = autocompleteBaseSchema.parse(payload);

      try {
        // Use the new Mapbox client with Garmr integration
        const data = await mapboxClient.autocomplete(query);

        return data.features.map((feature) => ({
          id: feature.properties.mapbox_id,
          country:
            feature.properties.context?.country?.name ||
            feature.properties.name,
          city:
            feature.properties.feature_type === 'place'
              ? feature.properties.name
              : null,
          subdivision: feature.properties.context?.region?.name || null,
        }));
      } catch (error) {
        // We return an empty array to not confuse the user, as they will likely continue typing and the autocomplete might succeed on consecutive requests.
        return [];
      }
    },
    autocompleteKeywords: async (
      _,
      payload: z.infer<typeof autocompleteKeywordsSchema>,
      ctx: AuthContext,
    ): Promise<GQLKeywordAutocomplete[]> => {
      const data = autocompleteKeywordsSchema.parse(payload);

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
    autocompleteCompany: async (
      _,
      payload: z.infer<typeof autocompleteCompanySchema>,
      ctx: AuthContext,
    ): Promise<GQLCompany[]> => {
      const { type, query, limit } = autocompleteCompanySchema.parse(payload);
      const slugQuery = Raw((alias) => `slugify(${alias}) = :slug`, {
        slug: textToSlug(query),
      });

      return await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(Company).find({
          take: limit,
          order: { name: 'ASC' },
          where: [
            { type, name: slugQuery },
            { type, name: ILike(`%${query}%`) },
          ],
        }),
      );
    },
  },
});
