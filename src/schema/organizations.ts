import type { IResolvers } from '@graphql-tools/utils';
import type { AuthContext, BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import { Organization } from '../entity/Organization';
import { OrganizationMemberRole, organizationRoleHierarchy } from '../roles';
import graphorm from '../graphorm';
import { toGQLEnum, uploadOrganizationImage } from '../common';
import type { GQLUser } from './users';
import type { GraphQLResolveInfo } from 'graphql';
import { ForbiddenError } from 'apollo-server-errors';
import { isNullOrUndefined } from '../common/object';
import { ContentPreferenceOrganization } from '../entity/contentPreference/ContentPreferenceOrganization';

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
  referralToken?: string;
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
    Update the organization
    """
    updateOrganization(
      """
      The ID of the organization to update
      """
      id: ID!

      """
      The name of the organization
      """
      name: String

      """
      Avatar image for the organization
      """
      image: Upload
    ): UserOrganization! @auth
  }
`;

export const ensureOrganizationRole = async (
  ctx: Context,
  {
    organizationId,
    requiredRole = OrganizationMemberRole.Member,
    userId,
  }: {
    organizationId?: string;
    requiredRole?: OrganizationMemberRole;
    userId?: string;
  },
) => {
  if (!organizationId || isNullOrUndefined(requiredRole)) {
    throw new ForbiddenError('Access denied!');
  }

  const res = await ctx.con
    .getRepository(ContentPreferenceOrganization)
    .findOneByOrFail({
      organizationId: organizationId,
      userId: userId || ctx.userId,
    });

  const userRole = res.flags?.role;

  if (isNullOrUndefined(userRole)) {
    throw new ForbiddenError('Access denied! No role assigned.');
  }

  const userRoleIndex = organizationRoleHierarchy.indexOf(userRole);
  const requiredRoleIndex = organizationRoleHierarchy.indexOf(requiredRole);

  // If either role is not found in the hierarchy, or the user's role is below the required role
  if (
    userRoleIndex === -1 ||
    requiredRoleIndex === -1 ||
    userRoleIndex > requiredRoleIndex
  ) {
    throw new ForbiddenError(
      `Access denied! You need to be a ${requiredRole.toLowerCase()} or higher to perform this action.`,
    );
  }

  return true;
};

const getOrganizationById = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  id: string,
): Promise<GQLUserOrganization> =>
  graphorm.queryOneOrFail<GQLUserOrganization>(ctx, info, (builder) => {
    builder.queryBuilder
      .andWhere(`${builder.alias}."userId" = :userId`, {
        userId: ctx.userId,
      })
      .andWhere(`${builder.alias}."organizationId" = :organizationId`, {
        organizationId: id,
      });

    return builder;
  });

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
    ): Promise<GQLUserOrganization[]> => {
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
      { id: organizationId },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      await ensureOrganizationRole(ctx, {
        organizationId,
        requiredRole: OrganizationMemberRole.Member,
      });
      return getOrganizationById(ctx, info, organizationId);
    },
  },
  Mutation: {
    updateOrganization: async (
      _,
      { id, name, image },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      await ensureOrganizationRole(ctx, {
        organizationId: id,
        requiredRole: OrganizationMemberRole.Admin,
      });

      try {
        const editedOrganizationId = await ctx.con.transaction(
          async (manager) => {
            const repo = manager.getRepository(Organization);

            await repo.update(id, {
              name: name,
            });

            if (image) {
              const { createReadStream } = await image;

              const stream = createReadStream();
              const { url: imageUrl } = await uploadOrganizationImage(
                id,
                stream,
              );

              await repo.update(id, {
                image: imageUrl,
              });
            }

            return id;
          },
        );

        return getOrganizationById(ctx, info, editedOrganizationId);
      } catch (_err) {
        const err = _err as Error;
        ctx.log.error(
          { err, organizationId: id },
          'Failed to update organization',
        );
        throw new Error('Failed to update organization');
      }
    },
  },
});
