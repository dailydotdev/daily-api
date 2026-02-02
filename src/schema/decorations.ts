import { IResolvers } from '@graphql-tools/utils';
import { AuthContext } from '../Context';
import { traceResolvers } from './trace';
import { Decoration, User, UserDecoration } from '../entity';
import graphorm from '../graphorm';
import { GraphQLResolveInfo } from 'graphql';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { ConflictError, TransferError } from '../errors';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../entity/user/UserTransaction';
import {
  getBalance,
  transferCores,
  throwUserTransactionError,
  type GetBalanceResult,
} from '../common/njord';
import { checkUserCoresAccess } from '../common/user';
import { parseBigInt, systemUser } from '../common/utils';
import { CoresRole } from '../types';
import { randomUUID } from 'node:crypto';

export interface GQLDecoration {
  id: string;
  name: string;
  media: string;
  decorationGroup: string;
  unlockCriteria: string | null;
  price: number | null;
  isUnlocked: boolean;
  isPurchasable: boolean;
}

export interface GQLPurchaseDecorationResult {
  decoration: GQLDecoration;
  balance: GetBalanceResult;
}

export interface GQLDecorationGroup {
  group: string;
  label: string;
  decorations: GQLDecoration[];
}

const DECORATION_GROUP_LABELS: Record<string, string> = {
  subscriber: 'Plus Member',
};

export const typeDefs = /* GraphQL */ `
  type Decoration {
    id: ID!
    name: String!
    media: String!
    decorationGroup: String!
    unlockCriteria: String
    price: Int
    isUnlocked: Boolean!
    isPurchasable: Boolean!
  }

  type DecorationGroup {
    group: String!
    label: String!
    decorations: [Decoration!]!
  }

  type PurchaseDecorationResult {
    decoration: Decoration!
    balance: Int!
  }

  extend type User {
    activeDecoration: Decoration
  }

  extend type Query {
    decorationsByGroup: [DecorationGroup!]! @auth
  }

  extend type Mutation {
    setActiveDecoration(decorationId: ID): User @auth
    purchaseDecoration(decorationId: ID!): PurchaseDecorationResult! @auth
  }
`;

export const resolvers: IResolvers<unknown, AuthContext> = traceResolvers<
  unknown,
  AuthContext
>({
  Query: {
    decorationsByGroup: async (_, __, ctx): Promise<GQLDecorationGroup[]> => {
      const decorations = await ctx.con.getRepository(Decoration).find({
        where: { active: true },
        order: { decorationGroup: 'ASC', groupOrder: 'ASC' },
      });

      const userDecorations = await ctx.con.getRepository(UserDecoration).find({
        where: { userId: ctx.userId },
        select: ['decorationId'],
      });
      const userDecorationIds = new Set(
        userDecorations.map((ud) => ud.decorationId),
      );

      const groupedDecorations = new Map<string, GQLDecoration[]>();

      for (const decoration of decorations) {
        const isUnlocked = userDecorationIds.has(decoration.id);
        const isPurchasable =
          decoration.price !== null && decoration.price > 0 && !isUnlocked;

        const gqlDecoration: GQLDecoration = {
          id: decoration.id,
          name: decoration.name,
          media: decoration.media,
          decorationGroup: decoration.decorationGroup,
          unlockCriteria: decoration.unlockCriteria,
          price: decoration.price,
          isUnlocked,
          isPurchasable,
        };

        const group = decoration.decorationGroup;
        if (!groupedDecorations.has(group)) {
          groupedDecorations.set(group, []);
        }
        groupedDecorations.get(group)!.push(gqlDecoration);
      }

      return Array.from(groupedDecorations.entries()).map(
        ([group, decorations]) => ({
          group,
          label: DECORATION_GROUP_LABELS[group] || group,
          decorations,
        }),
      );
    },
  },
  Mutation: {
    setActiveDecoration: async (
      _,
      { decorationId }: { decorationId: string | null },
      ctx,
      info: GraphQLResolveInfo,
    ): Promise<unknown> => {
      if (decorationId === null || decorationId === undefined) {
        await ctx.con
          .getRepository(User)
          .update({ id: ctx.userId }, { activeDecorationId: null });

        return graphorm.queryOneOrFail<User>(ctx, info, (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder.where(
            `"${builder.alias}"."id" = :id`,
            { id: ctx.userId },
          ),
        }));
      }

      const decoration = await ctx.con.getRepository(Decoration).findOneBy({
        id: decorationId,
        active: true,
      });

      if (!decoration) {
        throw new ValidationError('Decoration not found');
      }

      const userDecoration = await ctx.con
        .getRepository(UserDecoration)
        .findOneBy({
          userId: ctx.userId,
          decorationId,
        });

      if (!userDecoration) {
        throw new ForbiddenError('Decoration is not unlocked');
      }

      await ctx.con
        .getRepository(User)
        .update({ id: ctx.userId }, { activeDecorationId: decorationId });

      return graphorm.queryOneOrFail<User>(ctx, info, (builder) => ({
        ...builder,
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."id" = :id`,
          { id: ctx.userId },
        ),
      }));
    },
    purchaseDecoration: async (
      _,
      { decorationId }: { decorationId: string },
      ctx,
    ): Promise<GQLPurchaseDecorationResult> => {
      const { userId } = ctx;

      const user = await ctx.con
        .getRepository(User)
        .findOneByOrFail({ id: userId });

      if (
        !checkUserCoresAccess({
          user,
          requiredRole: CoresRole.User,
        })
      ) {
        throw new ForbiddenError('You do not have access to Cores');
      }

      const decoration = await ctx.con.getRepository(Decoration).findOneBy({
        id: decorationId,
        active: true,
      });

      if (!decoration) {
        throw new ValidationError('Decoration not found');
      }

      if (decoration.price === null || decoration.price <= 0) {
        throw new ValidationError(
          'This decoration is not available for purchase',
        );
      }

      const existingOwnership = await ctx.con
        .getRepository(UserDecoration)
        .findOneBy({
          userId,
          decorationId,
        });

      if (existingOwnership) {
        throw new ConflictError('You already own this decoration');
      }

      const userBalance = await getBalance({ userId });
      if (userBalance.amount < decoration.price) {
        throw new ConflictError('Not enough Cores to purchase this decoration');
      }

      const { transfer } = await ctx.con.transaction(async (entityManager) => {
        const userTransaction = await entityManager
          .getRepository(UserTransaction)
          .save(
            entityManager.getRepository(UserTransaction).create({
              id: randomUUID(),
              processor: UserTransactionProcessor.Njord,
              receiverId: systemUser.id,
              status: UserTransactionStatus.Success,
              productId: null,
              senderId: userId,
              value: decoration.price!,
              valueIncFees: decoration.price!,
              fee: 0,
              request: ctx.requestMeta,
              referenceType: UserTransactionType.DecorationPurchase,
              referenceId: decorationId,
              flags: {
                note: `Decoration purchase: ${decoration.name}`,
              },
            }),
          );

        try {
          await entityManager.getRepository(UserDecoration).insert({
            userId,
            decorationId,
          });

          const transfer = await transferCores({
            ctx,
            transaction: userTransaction,
            entityManager,
          });

          return { transfer };
        } catch (error) {
          if (error instanceof TransferError) {
            await throwUserTransactionError({
              ctx,
              entityManager,
              error,
              transaction: userTransaction,
            });
          }

          throw error;
        }
      });

      const newBalance = parseBigInt(transfer.senderBalance!.newBalance);

      return {
        decoration: {
          id: decoration.id,
          name: decoration.name,
          media: decoration.media,
          decorationGroup: decoration.decorationGroup,
          unlockCriteria: decoration.unlockCriteria,
          price: decoration.price,
          isUnlocked: true,
          isPurchasable: false,
        },
        balance: {
          amount: newBalance,
        },
      };
    },
  },
});
