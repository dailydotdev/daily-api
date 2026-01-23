import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { UserGear } from '../entity/user/UserGear';
import { ValidationError } from 'apollo-server-errors';
import {
  addUserGearSchema,
  reorderUserGearSchema,
  type AddUserGearInput,
  type ReorderUserGearInput,
} from '../common/schema/userGear';
import { findOrCreateDatasetGear } from '../common/datasetGear';
import { NEW_ITEM_POSITION } from '../common/constants';

interface GQLUserGear {
  id: string;
  userId: string;
  gearId: string;
  position: number;
  createdAt: Date;
}

export const typeDefs = /* GraphQL */ `
  type UserGear {
    id: ID!
    gear: DatasetGear!
    position: Int!
    createdAt: DateTime!
  }

  type UserGearEdge {
    node: UserGear!
    cursor: String!
  }

  type UserGearConnection {
    pageInfo: PageInfo!
    edges: [UserGearEdge!]!
  }

  type DatasetGear {
    id: ID!
    name: String!
  }

  input AddUserGearInput {
    name: String!
  }

  input ReorderUserGearInput {
    id: ID!
    position: Int!
  }

  extend type Query {
    """
    Get a user's gear
    """
    userGear(userId: ID!, first: Int, after: String): UserGearConnection!

    """
    Autocomplete gear from dataset
    """
    autocompleteGear(query: String!): [DatasetGear!]!
  }

  extend type Mutation {
    """
    Add gear to the user's profile (find-or-create in dataset)
    """
    addUserGear(input: AddUserGearInput!): UserGear! @auth

    """
    Delete a user's gear
    """
    deleteUserGear(id: ID!): EmptyResponse! @auth

    """
    Reorder user's gear
    """
    reorderUserGear(items: [ReorderUserGearInput!]!): [UserGear!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    userGear: async (
      _,
      args: { userId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      const pageGenerator = offsetPageGenerator<GQLUserGear>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLUserGear>(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          pageGenerator.nodeToCursor(page, { first: args.first }, node, index),
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."userId" = :userId`, {
              userId: args.userId,
            })
            .orderBy(`"${builder.alias}"."position"`, 'ASC')
            .addOrderBy(`"${builder.alias}"."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);
          return builder;
        },
        undefined,
        true,
      );
    },

    autocompleteGear: async (
      _,
      args: { query: string },
      ctx: Context,
    ) => {
      const query = args.query?.trim().toLowerCase();
      if (!query || query.length < 1) {
        return [];
      }

      const normalizedQuery = query
        .replace(/\./g, 'dot')
        .replace(/\+/g, 'plus')
        .replace(/#/g, 'sharp')
        .replace(/&/g, 'and')
        .replace(/\s+/g, '');

      const { DatasetGear } = await import('../entity/dataset/DatasetGear');
      const { queryReadReplica } = await import('../common/queryReadReplica');

      return queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(DatasetGear)
          .createQueryBuilder('dg')
          .where('dg."nameNormalized" LIKE :query', {
            query: `%${normalizedQuery}%`,
          })
          .setParameter('exactQuery', normalizedQuery)
          // Prioritize: exact match first, then shorter names, then alphabetically
          .orderBy(
            `CASE WHEN dg."nameNormalized" = :exactQuery THEN 0 ELSE 1 END`,
            'ASC',
          )
          .addOrderBy('LENGTH(dg."name")', 'ASC')
          .addOrderBy('dg."name"', 'ASC')
          .limit(10)
          .getMany(),
      );
    },
  },

  Mutation: {
    addUserGear: async (
      _,
      args: { input: AddUserGearInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addUserGearSchema.parse(args.input);

      const datasetGear = await findOrCreateDatasetGear(ctx.con, input.name);

      const existing = await ctx.con.getRepository(UserGear).findOne({
        where: {
          userId: ctx.userId,
          gearId: datasetGear.id,
        },
      });

      if (existing) {
        throw new ValidationError('Gear already exists in your profile');
      }

      const userGear = ctx.con.getRepository(UserGear).create({
        userId: ctx.userId,
        gearId: datasetGear.id,
        position: NEW_ITEM_POSITION,
      });

      await ctx.con.getRepository(UserGear).save(userGear);

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: userGear.id,
        });
        return builder;
      });
    },

    deleteUserGear: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(UserGear)
        .delete({ id: args.id, userId: ctx.userId });

      return { _: true };
    },

    reorderUserGear: async (
      _,
      args: { items: ReorderUserGearInput[] },
      ctx: AuthContext,
      info,
    ) => {
      const items = reorderUserGearSchema.parse(args.items);
      const ids = items.map((i) => i.id);

      const whenClauses = items
        .map((item) => `WHEN id = '${item.id}' THEN ${item.position}`)
        .join(' ');

      await ctx.con
        .getRepository(UserGear)
        .createQueryBuilder()
        .update()
        .set({ position: () => `CASE ${whenClauses} ELSE position END` })
        .where('id IN (:...ids)', { ids })
        .andWhere('"userId" = :userId', { userId: ctx.userId })
        .execute();

      return graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder
          .where(`"${builder.alias}"."id" IN (:...ids)`, { ids })
          .andWhere(`"${builder.alias}"."userId" = :userId`, {
            userId: ctx.userId,
          })
          .orderBy(`"${builder.alias}"."position"`, 'ASC');
        return builder;
      });
    },
  },
});
