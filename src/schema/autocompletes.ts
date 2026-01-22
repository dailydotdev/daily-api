import { Keyword, KeywordStatus } from '../entity';
import { AutocompleteType, Autocomplete } from '../entity/Autocomplete';
import { traceResolvers } from './trace';
import { FindOptionsWhere, ILike, Raw } from 'typeorm';
import { AuthContext, BaseContext } from '../Context';
import { textToSlug, toGQLEnum, type GQLCompany } from '../common';
import { queryReadReplica } from '../common/queryReadReplica';
import {
  autocompleteCompanySchema,
  autocompleteGithubRepositorySchema,
  autocompleteKeywordsSchema,
  autocompleteLocationSchema,
  autocompleteSchema,
  LocationDataset,
} from '../common/schema/autocompletes';
import { gitHubClient } from '../integrations/github/clients';
import type { GQLGitHubRepository } from '../integrations/github/types';
import type z from 'zod';
import { Company, CompanyType } from '../entity/Company';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';
import { mapboxClient } from '../integrations/mapbox/clients';

interface AutocompleteData {
  result: string[];
}

interface GQLKeywordAutocomplete {
  keyword: string;
  title: string | null;
}

interface GQLLocation {
  id: string | null;
  country: string | null;
  city: string | null;
  subdivision: string | null;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(AutocompleteType, 'AutocompleteType')}
  ${toGQLEnum(CompanyType, 'CompanyType')}
  ${toGQLEnum(LocationDataset, 'LocationDataset')}

  type AutocompleteData {
    result: [String]!
  }

  type KeywordAutocomplete {
    keyword: String!
    title: String
  }

  type Location {
    id: ID
    country: String
    city: String
    subdivision: String
  }

  type GitHubRepository {
    id: ID!
    owner: String!
    name: String!
    fullName: String!
    url: String!
    image: String!
    description: String
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
    autocompleteLocation(
      query: String!
      dataset: LocationDataset
      limit: Int = 5
    ): [Location]! @auth @cacheControl(maxAge: 3600)

    autocompleteKeywords(
      query: String!
      limit: Int = 20
    ): [KeywordAutocomplete!]! @cacheControl(maxAge: 3600)

    autocompleteCompany(
      query: String!
      limit: Int
      type: CompanyType
    ): [Company]! @cacheControl(maxAge: 3600)

    autocompleteGithubRepository(
      query: String!
      limit: Int = 10
    ): [GitHubRepository]! @auth @cacheControl(maxAge: 3600)
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
      payload: z.infer<typeof autocompleteLocationSchema>,
      ctx: AuthContext,
    ): Promise<GQLLocation[]> => {
      const { query, dataset, limit } =
        autocompleteLocationSchema.parse(payload);

      try {
        if (dataset === LocationDataset.Internal) {
          const results = await queryReadReplica(ctx.con, ({ queryRunner }) =>
            queryRunner.manager
              .createQueryBuilder(DatasetLocation, 'dl')
              .where('dl.country ILIKE :query', { query: `%${query}%` })
              .orWhere('dl.city ILIKE :query', { query: `%${query}%` })
              .orWhere('dl.subdivision ILIKE :query', { query: `%${query}%` })
              .orWhere('dl.continent ILIKE :query', { query: `%${query}%` })
              .orderBy('dl.country', 'ASC')
              .addOrderBy('dl.subdivision', 'ASC', 'NULLS FIRST')
              .addOrderBy('dl.city', 'ASC', 'NULLS FIRST')
              .limit(limit)
              .getMany(),
          );

          return results.map((location) => ({
            // we map externalId to match mapbox IDs when in external dataset mode
            id: location.externalId,
            country: location.country || location.continent,
            city: location.city,
            subdivision: location.subdivision,
          }));
        }

        // Use the new Mapbox client with Garmr integration
        const data = await mapboxClient.autocomplete(query, limit);

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
      const slug = textToSlug(query);

      const whereConditions: FindOptionsWhere<Company>[] = [
        { type, name: ILike(`%${query}%`) },
        { type, altName: ILike(`%${query}%`) },
      ];

      // Only add slug-based search if the slug is non-empty
      // (non-Latin characters like Korean get stripped by slugify, causing false matches)
      if (slug) {
        const slugQuery = Raw((alias) => `slugify(${alias}) = :slug`, {
          slug,
        });
        whereConditions.unshift(
          { type, name: slugQuery },
          { type, altName: slugQuery },
        );
      }

      return await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(Company).find({
          take: limit,
          order: { name: 'ASC' },
          where: whereConditions,
        }),
      );
    },
    autocompleteGithubRepository: async (
      _,
      payload: z.infer<typeof autocompleteGithubRepositorySchema>,
    ): Promise<GQLGitHubRepository[]> => {
      const { query, limit } =
        autocompleteGithubRepositorySchema.parse(payload);

      try {
        const data = await gitHubClient.searchRepositories(query, limit);

        return data.items.map((repo) => ({
          id: String(repo.id),
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          url: repo.html_url,
          image: repo.owner.avatar_url,
          description: repo.description,
        }));
      } catch {
        return [];
      }
    },
  },
});
