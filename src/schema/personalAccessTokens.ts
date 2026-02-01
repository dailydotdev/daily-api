import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import { GQLEmptyResponse } from './common';
import {
  PersonalAccessToken,
  MAX_PERSONAL_ACCESS_TOKENS_PER_USER,
} from '../entity/PersonalAccessToken';
import { ValidationError, ForbiddenError } from 'apollo-server-errors';
import {
  createPersonalAccessTokenSchema,
  type CreatePersonalAccessTokenInput,
} from '../common/schema/personalAccessToken';
import { generatePersonalAccessToken } from '../common/personalAccessToken';
import { v4 as uuidv4 } from 'uuid';
import { IsNull } from 'typeorm';
import { ONE_DAY_IN_SECONDS } from '../common/constants';

interface GQLPersonalAccessToken {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

interface GQLPersonalAccessTokenCreated {
  id: string;
  name: string;
  token: string;
  tokenPrefix: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export const typeDefs = /* GraphQL */ `
  type PersonalAccessToken {
    id: ID!
    name: String!
    tokenPrefix: String!
    createdAt: DateTime!
    expiresAt: DateTime
    lastUsedAt: DateTime
  }

  type PersonalAccessTokenCreated {
    id: ID!
    name: String!
    token: String!
    tokenPrefix: String!
    createdAt: DateTime!
    expiresAt: DateTime
  }

  input CreatePersonalAccessTokenInput {
    name: String!
    expiresInDays: Int
  }

  extend type Query {
    """
    Get all personal access tokens for the current user
    """
    personalAccessTokens: [PersonalAccessToken!]! @auth
  }

  extend type Mutation {
    """
    Create a new personal access token (Plus users only)
    """
    createPersonalAccessToken(
      input: CreatePersonalAccessTokenInput!
    ): PersonalAccessTokenCreated! @auth

    """
    Revoke a personal access token
    """
    revokePersonalAccessToken(id: ID!): EmptyResponse! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    personalAccessTokens: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLPersonalAccessToken[]> => {
      const tokens = await ctx.con.getRepository(PersonalAccessToken).find({
        where: {
          userId: ctx.userId,
          revokedAt: IsNull(),
        },
        order: { createdAt: 'DESC' },
      });

      return tokens.map((token) => ({
        id: token.id,
        name: token.name,
        tokenPrefix: token.tokenPrefix,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        lastUsedAt: token.lastUsedAt,
      }));
    },
  },

  Mutation: {
    createPersonalAccessToken: async (
      _,
      args: { input: CreatePersonalAccessTokenInput },
      ctx: AuthContext,
    ): Promise<GQLPersonalAccessTokenCreated> => {
      const input = createPersonalAccessTokenSchema.parse(args.input);

      if (!ctx.isPlus) {
        throw new ForbiddenError(
          'API access requires an active Plus subscription',
        );
      }

      const existingCount = await ctx.con
        .getRepository(PersonalAccessToken)
        .count({
          where: {
            userId: ctx.userId,
            revokedAt: IsNull(),
          },
        });

      if (existingCount >= MAX_PERSONAL_ACCESS_TOKENS_PER_USER) {
        throw new ValidationError(
          `Maximum of ${MAX_PERSONAL_ACCESS_TOKENS_PER_USER} tokens allowed per user`,
        );
      }

      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * ONE_DAY_IN_SECONDS * 1000)
        : null;

      const patEntity = ctx.con.getRepository(PersonalAccessToken).create({
        id: uuidv4(),
        userId: ctx.userId,
        name: input.name,
        tokenHash,
        tokenPrefix,
        expiresAt,
      });

      await ctx.con.getRepository(PersonalAccessToken).save(patEntity);

      return {
        id: patEntity.id,
        name: patEntity.name,
        token,
        tokenPrefix: patEntity.tokenPrefix,
        createdAt: patEntity.createdAt,
        expiresAt: patEntity.expiresAt,
      };
    },

    revokePersonalAccessToken: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const result = await ctx.con.getRepository(PersonalAccessToken).update(
        {
          id: args.id,
          userId: ctx.userId,
          revokedAt: IsNull(),
        },
        { revokedAt: new Date() },
      );

      if (result.affected === 0) {
        throw new ValidationError('Token not found or already revoked');
      }

      return { _: true };
    },
  },
});
