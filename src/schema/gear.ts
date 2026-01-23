import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { UserGear } from '../entity/user/UserGear';
import { ValidationError } from 'apollo-server-errors';
import {
  addGearSchema,
  reorderGearSchema,
  type AddGearInput,
  type ReorderGearInput,
} from '../common/schema/gear';
import { findOrCreateDatasetGear } from '../common/datasetGear';
import { NEW_ITEM_POSITION } from '../common/constants';

interface GQLGear {
  id: string;
  userId: string;
  gearId: string;
  position: number;
  createdAt: Date;
}

export const typeDefs = /* GraphQL */ `
  type Gear {
    id: ID!
    gear: DatasetGear!
    position: Int!
    createdAt: DateTime!
  }

  type GearEdge {
    node: Gear!
    cursor: String!
  }

  type GearConnection {
    pageInfo: PageInfo!
    edges: [GearEdge!]!
  }

  type DatasetGear {
    id: ID!
    name: String!
  }

  input AddGearInput {
    name: String!
  }

  input ReorderGearInput {
    id: ID!
    position: Int!
  }

  extend type Query {
    """
    Get a user's gear
    """
    gear(userId: ID!, first: Int, after: String): GearConnection!
  }

  extend type Mutation {
    """
    Add gear to the user's profile (find-or-create in dataset)
    """
    addGear(input: AddGearInput!): Gear! @auth

    """
    Delete a user's gear
    """
    deleteGear(id: ID!): EmptyResponse! @auth

    """
    Reorder user's gear
    """
    reorderGear(items: [ReorderGearInput!]!): [Gear!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    gear: async (
      _,
      args: { userId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      const pageGenerator = offsetPageGenerator<GQLGear>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLGear>(
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
  },

  Mutation: {
    addGear: async (
      _,
      args: { input: AddGearInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addGearSchema.parse(args.input);

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

      const gear = ctx.con.getRepository(UserGear).create({
        userId: ctx.userId,
        gearId: datasetGear.id,
        position: NEW_ITEM_POSITION,
      });

      await ctx.con.getRepository(UserGear).save(gear);

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: gear.id,
        });
        return builder;
      });
    },

    deleteGear: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(UserGear)
        .delete({ id: args.id, userId: ctx.userId });

      return { _: true };
    },

    reorderGear: async (
      _,
      args: { items: ReorderGearInput[] },
      ctx: AuthContext,
      info,
    ) => {
      const items = reorderGearSchema.parse(args.items);
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
