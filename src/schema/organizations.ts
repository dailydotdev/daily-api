import type { IResolvers } from '@graphql-tools/utils';
import { ForbiddenError } from 'apollo-server-errors';
import type { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import { Organization } from '../entity/Organization';
import { OrganizationMemberRole } from '../roles';
import graphorm from '../graphorm';
import { toGQLEnum, updateSubscriptionFlags } from '../common';
import type { GQLUser } from './users';
import type { GQLEmptyResponse } from './common';
import { User } from '../entity';
import { ContentPreferenceOrganization } from '../entity/contentPreference/ContentPreferenceOrganization';
import type { TypeORMQueryFailedError } from '../errors';

export type GQLOrganizationMember = {
  role: OrganizationMemberRole;
  user: GQLUser;
};
export type GQLOrganization = Omit<
  Organization,
  'subscriptionFlags' | 'members'
> & {
  members: GQLOrganizationMember[];
};
export type GQLUserOrganization = {
  createdAt: Date;
  role: OrganizationMemberRole;
  organization: GQLOrganization;
};

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(OrganizationMemberRole, 'OrganizationMemberRole')}

  type OrganizationMember {
    """
    Role of the user in the organization
    """
    role: OrganizationMemberRole!

    """
    The user in the organization
    """
    user: User!
  }

  type Organization {
    """
    The ID of the organization
    """
    id: ID!

    """
    The name of the organization
    """
    name: String!

    """
    The image of the organization
    """
    image: String

    """
    The number of seats in the organization
    """
    seats: Int

    """
    The members of the organization
    """
    members: [OrganizationMember!]!
  }

  type UserOrganization {
    """
    Role of the user in the organization
    """
    role: OrganizationMemberRole!

    """
    Referral token for the user
    """
    referralToken: String

    """
    The organization
    """
    organization: Organization!
  }

  extend type Query {
    """
    Get the organizations of the user
    """
    organizations: [UserOrganization] @auth

    """
    Get the organization by ID
    """
    organization(id: ID!): UserOrganization @auth
  }

  extend type Mutation {
    """
    Removes the logged-in user from a organization
    """
    leaveOrganization(
      """
      The ID of the organization to leave
      """
      id: ID!
    ): EmptyResponse @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    organizations: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLOrganization[]> => {
      return graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.andWhere(`${builder.alias}."userId" = :userId`, {
            userId: ctx.userId,
          });

          return builder;
        },
        true,
      );
    },
    organization: async (
      _,
      { id },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder
          .andWhere(`${builder.alias}."userId" = :userId`, {
            userId: ctx.userId,
          })
          .andWhere(`${builder.alias}."organizationId" = :organizationId`, {
            organizationId: id,
          });

        return builder;
      });
    },
  },
  Mutation: {
    leaveOrganization: async (
      _,
      { id: organizationId },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      try {
        await ctx.con.transaction(async (manager) => {
          const member = await manager.getRepository(User).findOneByOrFail({
            id: ctx.userId,
          });

          const { flags } = await manager
            .getRepository(ContentPreferenceOrganization)
            .findOneOrFail({
              select: ['flags'],
              where: {
                organizationId,
                userId: member.id,
              },
            });

          if (flags?.role === OrganizationMemberRole.Owner) {
            throw new ForbiddenError(`Access denied! Owner can't be removed`);
          }

          const organizationSeatUser =
            member.subscriptionFlags?.organizationId === organizationId;

          await Promise.all([
            manager.getRepository(ContentPreferenceOrganization).delete({
              userId: member.id,
              organizationId,
            }),
            organizationSeatUser &&
              manager.getRepository(User).update(
                { id: member.id },
                {
                  subscriptionFlags: updateSubscriptionFlags({
                    subscriptionId: null,
                    cycle: null,
                    createdAt: null,
                    provider: null,
                    status: null,
                    organizationId: null,
                  }),
                },
              ),
          ]);
        });
      } catch (_err) {
        const err = _err as TypeORMQueryFailedError;
        throw err;
      }
      return { _: true };
    },
  },
});
