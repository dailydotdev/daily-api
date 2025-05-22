import type { IResolvers } from '@graphql-tools/utils';
import type { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import { Organization } from '../entity/Organization';
import type { OrganizationMemberRoles } from '../roles';
import graphorm from '../graphorm';

export type GQLOrganization = Omit<Organization, 'subscriptionFlags'>;
export type GQLUserOrganization = {
  createdAt: Date;
  role: OrganizationMemberRoles;
  organization: GQLOrganization;
};

export const typeDefs = /* GraphQL */ `
  type Organization {
    id: ID!
    name: String!
    image: String
    seats: Int
  }

  type UserOrganization {
    """
    Role of the user in the organization
    """
    role: String!

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
