import { ValidationError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { z } from 'zod';
import { BaseContext, Context } from '../Context';
import { ArchivePeriodType, getArchivePeriodStart } from '../common/archive';
import {
  archiveIndexQuerySchema,
  archiveQuerySchema,
} from '../common/schema/archive';
import graphorm from '../graphorm';

type GQLArchive = {
  id: string;
  subjectType: string;
  rankingType: string;
  scopeType: string;
  scopeId: string | null;
  periodType: string;
  periodStart: Date;
};

type ArchiveQueryArgs = z.infer<typeof archiveQuerySchema>;
type ArchiveIndexQueryArgs = z.infer<typeof archiveIndexQuerySchema>;

export const typeDefs = /* GraphQL */ `
  type ArchiveItem {
    rank: Int!
    post: Post
  }

  type Archive {
    id: ID!
    subjectType: String!
    rankingType: String!
    scopeType: String!
    scopeId: String
    periodType: String!
    periodStart: DateTime!
    keyword: Keyword
    source: Source
    items: [ArchiveItem!]!
  }

  extend type Query {
    archive(
      subjectType: String!
      rankingType: String!
      scopeType: String!
      scopeId: String
      periodType: String!
      year: Int!
      month: Int
    ): Archive @cacheControl(maxAge: 3600)

    archiveIndex(
      subjectType: String!
      rankingType: String!
      scopeType: String!
      scopeId: String
      periodType: String
      year: Int
    ): [Archive!]! @cacheControl(maxAge: 3600)
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    archive: async (
      _,
      args: ArchiveQueryArgs,
      ctx: Context,
      info,
    ): Promise<GQLArchive | null> => {
      const validatedArgsResult = archiveQuerySchema.safeParse(args);

      if (!validatedArgsResult.success) {
        throw new ValidationError(validatedArgsResult.error.issues[0].message);
      }

      const validatedArgs = validatedArgsResult.data;
      const periodStart = getArchivePeriodStart(validatedArgs);

      return graphorm.queryOne<GQLArchive>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere(`${builder.alias}."subjectType" = :subjectType`, {
              subjectType: validatedArgs.subjectType,
            })
            .andWhere(`${builder.alias}."rankingType" = :rankingType`, {
              rankingType: validatedArgs.rankingType,
            })
            .andWhere(`${builder.alias}."scopeType" = :scopeType`, {
              scopeType: validatedArgs.scopeType,
            })
            .andWhere(`${builder.alias}."periodType" = :periodType`, {
              periodType: validatedArgs.periodType,
            })
            .andWhere(`${builder.alias}."periodStart" = :periodStart`, {
              periodStart,
            })
            .limit(1);

          if (validatedArgs.scopeId) {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."scopeId" = :scopeId`,
              { scopeId: validatedArgs.scopeId },
            );
          } else {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."scopeId" IS NULL`,
            );
          }

          return builder;
        },
        true,
      );
    },
    archiveIndex: async (
      _,
      args: ArchiveIndexQueryArgs,
      ctx: Context,
      info,
    ): Promise<GQLArchive[]> => {
      const validatedArgsResult = archiveIndexQuerySchema.safeParse(args);

      if (!validatedArgsResult.success) {
        throw new ValidationError(validatedArgsResult.error.issues[0].message);
      }

      const validatedArgs = validatedArgsResult.data;

      return graphorm.query<GQLArchive>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere(`${builder.alias}."subjectType" = :subjectType`, {
              subjectType: validatedArgs.subjectType,
            })
            .andWhere(`${builder.alias}."rankingType" = :rankingType`, {
              rankingType: validatedArgs.rankingType,
            })
            .orderBy(`${builder.alias}."periodStart"`, 'ASC')
            .addOrderBy(`${builder.alias}."scopeType"`, 'ASC')
            .addOrderBy(`${builder.alias}."scopeId"`, 'ASC');

          builder.queryBuilder = builder.queryBuilder.andWhere(
            `${builder.alias}."scopeType" = :scopeType`,
            { scopeType: validatedArgs.scopeType },
          );

          if (validatedArgs.scopeId) {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."scopeId" = :scopeId`,
              { scopeId: validatedArgs.scopeId },
            );
          }

          if (validatedArgs.periodType) {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."periodType" = :periodType`,
              { periodType: validatedArgs.periodType },
            );
          }

          if (validatedArgs.year) {
            const yearPeriodStart = getArchivePeriodStart({
              periodType: ArchivePeriodType.Year,
              year: validatedArgs.year,
            });
            const nextYearPeriodStart = getArchivePeriodStart({
              periodType: ArchivePeriodType.Year,
              year: validatedArgs.year + 1,
            });

            builder.queryBuilder = builder.queryBuilder
              .andWhere(`${builder.alias}."periodStart" >= :yearPeriodStart`, {
                yearPeriodStart,
              })
              .andWhere(
                `${builder.alias}."periodStart" < :nextYearPeriodStart`,
                {
                  nextYearPeriodStart,
                },
              );
          }

          return builder;
        },
        true,
      );
    },
  },
};
