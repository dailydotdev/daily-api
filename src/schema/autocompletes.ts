import { Keyword, KeywordStatus } from '../entity';
import { Autocomplete } from '../entity/Autocomplete';
import { traceResolvers } from './trace';
import { ILike, type DataSource, type FindOptionsWhere } from 'typeorm';
import { AuthContext, BaseContext } from '../Context';
import { toGQLEnum } from '../common';
import { queryReadReplica } from '../common/queryReadReplica';
import {
  autocompleteBaseSchema,
  autocompleteSchema,
  AutocompleteType,
} from '../common/schema/autocompletes';
import type z from 'zod';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';
import { toSkillSlug, UserSkill } from '../entity/user/UserSkill';

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

  type AutocompleteData {
    result: [String]!
  }

  type KeywordAutocomplete {
    keyword: String!
    title: String
  }

  type Location {
    id: ID!
    country: String!
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
  }
`;

type FindLocation = FindOptionsWhere<DatasetLocation>;

const getLocationCondition = (query: string): FindLocation[] => {
  const [country, subdivision, city] = query
    .split(',')
    .reverse()
    .map((s) => s.trim());
  const base: FindLocation[] = [{ country: ILike(`%${country}%`) }];

  if (country.length === 2) {
    base.push({ iso2: country.toUpperCase() });
  } else if (country.length === 3) {
    base.push({ iso3: country.toUpperCase() });
  }

  if (!subdivision) {
    return base.concat([
      { subdivision: ILike(`%${query}%`) },
      { city: ILike(`%${query}%`) },
    ]);
  }

  if (city) {
    return base.map((conditions) => ({
      ...conditions,
      city: ILike(`%${city}%`),
      subdivision: ILike(`%${subdivision}%`),
    }));
  }

  const subdivisionCombination: FindLocation[] = base.map((conditions) => ({
    ...conditions,
    subdivision: ILike(`%${subdivision}%`),
  }));
  const cityCombination: FindLocation[] = base.map((conditions) => ({
    ...conditions,
    city: ILike(`%${subdivision}%`),
  }));

  return subdivisionCombination.concat(cityCombination);
};

type AutocompleteFn = (
  con: DataSource,
  payload: z.infer<typeof autocompleteSchema>,
) => Promise<AutocompleteData>;

const getGenericAutocomplete: AutocompleteFn = async (
  con,
  { type, query, limit },
) => {
  const result = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(Autocomplete).find({
      select: { value: true },
      take: limit,
      order: { value: 'ASC' },
      where: { enabled: true, type, value: ILike(`%${query}%`) },
    }),
  );

  return { result: result.map((a) => a.value) };
};

const getSkillAutocomplete: AutocompleteFn = async (con, { query, limit }) => {
  const result = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(UserSkill).find({
      select: { name: true },
      take: limit,
      order: { name: 'ASC' },
      where: [
        { valid: true, slug: toSkillSlug(query) },
        { valid: true, name: ILike(`%${query}%`) },
      ],
    }),
  );

  return { result: result.map((a) => a.name) };
};

export const resolvers = traceResolvers<unknown, BaseContext>({
  Query: {
    autocomplete: async (
      _,
      payload: z.infer<typeof autocompleteSchema>,
      ctx: AuthContext,
    ): Promise<AutocompleteData> => {
      switch (payload.type) {
        case AutocompleteType.Skill:
          return getSkillAutocomplete(ctx.con, payload);
        default:
          return getGenericAutocomplete(ctx.con, payload);
      }
    },
    autocompleteLocation: async (
      _,
      payload: z.infer<typeof autocompleteSchema>,
      ctx: AuthContext,
    ): Promise<GQLLocation[]> => {
      const { query, limit } = autocompleteBaseSchema.parse(payload);
      const conditions = getLocationCondition(query);

      const result = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(DatasetLocation).find({
          select: { id: true, country: true, subdivision: true, city: true },
          take: limit,
          order: {
            ranking: 'DESC',
            city: 'ASC',
          },
          where: conditions,
        }),
      );

      return result;
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
