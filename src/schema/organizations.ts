import type { IResolvers } from '@graphql-tools/utils';
import type { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import { Organization } from '../entity/Organization';
import { OrganizationMemberRole } from '../roles';
import graphorm from '../graphorm';
import { toGQLEnum } from '../common';
import type { GQLUser } from './users';

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
});
