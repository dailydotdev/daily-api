import type { FileHandle } from 'node:fs/promises';
import type { IResolvers } from '@graphql-tools/utils';
import { z } from 'zod';
import { ForbiddenError } from 'apollo-server-errors';
import type { AuthContext, BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import { Organization } from '../entity/Organization';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';
import { createLocationFromMapbox } from '../entity/dataset/utils';
import {
  isRoleAtLeast,
  OrganizationMemberRole,
  organizationRoleHierarchy,
} from '../roles';
import graphorm from '../graphorm';
import {
  notifyOrganizationUserJoined,
  notifyOrganizationUserLeft,
  notifyOrganizationUserRemoved,
  toGQLEnum,
  updateFlagsStatement,
  updateSubscriptionFlags,
  uploadOrganizationImage,
} from '../common';
import type { GQLUser } from './users';
import type { GraphQLResolveInfo } from 'graphql';
import { isNullOrUndefined } from '../common/object';
import {
  ContentPreferenceOrganization,
  ContentPreferenceOrganizationStatus,
} from '../entity/contentPreference/ContentPreferenceOrganization';
import { TypeOrmError, type TypeORMQueryFailedError } from '../errors';
import type { GQLEmptyResponse } from './common';
import { randomUUID } from 'node:crypto';
import { JsonContains } from 'typeorm';
import { User } from '../entity';
import { isPlusMember } from '../paddle';
import {
  getPrice,
  getPricingDuration,
  getPricingMetadataByPriceIds,
  getProductPrice,
} from '../common/paddle/pricing';
import {
  fetchSubscriptionUpdatePreview,
  subscriptionUpdateSchema,
  updateOrganizationSubscription,
} from '../common/paddle/organization';
import { parsePaddlePriceInCents } from '../common/paddle';
import { SubscriptionStatus } from '../common/plus';
import {
  OrganizationLinkType,
  organizationSubscriptionFlagsSchema,
  SocialMediaType,
} from '../common/schema/organizations';

export type GQLOrganizationMember = {
  role: OrganizationMemberRole;
  seatType: ContentPreferenceOrganizationStatus;
  lastActive: Date | null;
  user: GQLUser;
  userId?: string;
};
export type GQLOrganization = Omit<
  Organization,
  'subscriptionFlags' | 'members'
> & {
  members: GQLOrganizationMember[];
  activeSeats: number;
};
export type GQLUserOrganization = {
  createdAt: Date;
  role: OrganizationMemberRole;
  referralToken?: string;
  organization: GQLOrganization;
  referralUrl?: string;
};

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(SubscriptionStatus, 'SubscriptionStatus')}
  ${toGQLEnum(OrganizationMemberRole, 'OrganizationMemberRole')}
  ${toGQLEnum(
    ContentPreferenceOrganizationStatus,
    'OrganizationMemberSeatType',
  )}
  ${toGQLEnum(OrganizationLinkType, 'OrganizationLinkType')}
  ${toGQLEnum(SocialMediaType, 'SocialMediaType')}

  type OrganizationMember {
    """
    Role of the user in the organization
    """
    role: OrganizationMemberRole!

    """
    The seat type of the user in the organization
    """
    seatType: OrganizationMemberSeatType!

    """
    The user in the organization
    """
    user: User!

    """
    The organization the user is a member of
    """
    organization: Organization

    """
    The date user was last active
    """
    lastActive: DateTime
  }

  type OrganizationLink {
    type: OrganizationLinkType!
    socialType: SocialMediaType
    title: String
    link: String!
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
    seats: Int!

    """
    The number of active seats in the organization
    """
    activeSeats: Int!

    """
    The members of the organization
    """
    members: [OrganizationMember!]!

    """
    The subscription status of the organization
    """
    status: SubscriptionStatus!

    """
    The website URL of the organization
    """
    website: String

    """
    The description of the organization
    """
    description: String

    """
    The perks offered by the organization
    """
    perks: [String!]

    """
    The year the organization was founded
    """
    founded: Int

    """
    The category of the organization
    """
    category: String

    """
    The size of the organization
    """
    size: ProtoEnumValue

    """
    The stage of the organization
    """
    stage: ProtoEnumValue

    """
    The links associated with the organization
    """
    customLinks: [OrganizationLink!]
    socialLinks: [OrganizationLink!]
    pressLinks: [OrganizationLink!]

    """
    The structured location from dataset
    """
    location: Location
  }

  type ProratedPricePreview {
    subTotal: PricePreview
    tax: PricePreview
    total: PricePreview
  }

  type OrganizationSubscription {
    """
    Preview of the updated pricing details of the subscription
    """
    pricing: [BaseProductPricingPreview!]!

    """
    The next billing date of the subscription
    """
    nextBilling: DateTime

    """
    The prorated price of the subscription update
    """
    prorated: ProratedPricePreview

    """
    The total price of the subscription update
    """
    total: ProductPricePreview
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

    """
    URL for inviting and referring new users
    """
    referralUrl: String

    """
    The seat type of the user in the organization
    """
    seatType: OrganizationMemberSeatType!
  }

  extend type Query {
    """
    Get the organizations of the user
    """
    organizations: [UserOrganization] @auth

    """
    Get the organization by ID
    """
    organization(
      """
      The ID of the organization to get
      """
      id: ID!
    ): UserOrganization @auth

    """
    Get the organization by ID and invite token
    """
    getOrganizationByIdAndInviteToken(
      """
      The ID of the organization to get
      """
      id: ID!

      """
      Referral token of the admin who invited the user
      """
      token: String!
    ): OrganizationMember

    """
    Preview the organization subscription update
    """
    previewOrganizationSubscriptionUpdate(
      """
      The ID of the organization
      """
      id: ID!

      """
      The number of seats to update to
      """
      quantity: Int!

      """
      The locale to use for formatting prices
      """
      locale: String
    ): OrganizationSubscription @auth
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

      """
      External location ID from Mapbox for the organization location
      """
      externalLocationId: String
    ): UserOrganization! @auth

    """
    Adds the logged-in user as a member of the organization
    """
    joinOrganization(
      """
      The ID of the organization to join
      """
      id: ID!

      """
      Referral token of the admin who invited the user
      """
      token: String!
    ): UserOrganization! @auth

    """
    Removes the logged-in user from a organization
    """
    leaveOrganization(
      """
      The ID of the organization to leave
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Update the organization subscription
    """
    updateOrganizationSubscription(
      """
      The ID of the organization to update
      """
      id: ID!

      """
      The number of seats to update to
      """
      quantity: Int!
    ): UserOrganization @auth

    """
    Delete the organization
    """
    deleteOrganization(
      """
      The ID of the organization to delete
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Remove a member from the organization
    """
    removeOrganizationMember(
      """
      The ID of the organization to remove the member from
      """
      id: ID!

      """
      The ID of the member to remove
      """
      memberId: String!
    ): UserOrganization! @auth

    """
    Update the role of a member in the organization
    """
    updateOrganizationMemberRole(
      """
      The ID of the organization to update the member role in
      """
      id: ID!
      """
      The ID of the member to update the role for
      """
      memberId: String!
      """
      The new role to assign to the member
      """
      role: OrganizationMemberRole!
    ): UserOrganization! @auth

    """
    Toggle the seat of a member in the organization
    """
    toggleOrganizationMemberSeat(
      """
      The ID of the organization to toggle the member seat in
      """
      id: ID!
      """
      The ID of the member to update the role for
      """
      memberId: String!
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

  if (!isRoleAtLeast(userRole, requiredRole, organizationRoleHierarchy)) {
    throw new ForbiddenError(
      `Access denied! You need to be a ${requiredRole.toLowerCase()} or higher to perform this action.`,
    );
  }

  return true;
};

const verifyOrganizationInviter = async (
  ctx: Context,
  organizationId: string,
  token: string,
): Promise<ContentPreferenceOrganization> => {
  const inviter = await ctx.con
    .getRepository(ContentPreferenceOrganization)
    .findOneBy({
      organizationId,
      flags: JsonContains({
        referralToken: token,
      }),
    });

  if (!inviter) {
    throw new ForbiddenError('Invalid invitation token');
  }

  if (
    !isRoleAtLeast(
      inviter.flags?.role || OrganizationMemberRole.Member,
      OrganizationMemberRole.Admin,
      organizationRoleHierarchy,
    )
  ) {
    throw new ForbiddenError(
      'The person who invited you does not have permission to invite you to this organization.',
    );
  }

  return inviter;
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

export const updateOrganizationSchema = z.object({
  id: z.string({
    error: 'Organization ID is required',
  }),
  name: z.string().trim().min(1, 'Organization name is required'),
  image: z.instanceof(Promise<FileHandle>).optional(),
  externalLocationId: z.string().optional(),
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
    getOrganizationByIdAndInviteToken: async (
      _,
      { id: organizationId, token },
      ctx: AuthContext,
      info,
    ) => {
      await verifyOrganizationInviter(ctx, organizationId, token);

      return graphorm.queryOneOrFail<GQLOrganizationMember>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .andWhere(`${builder.alias}."organizationId" = :organizationId`, {
              organizationId,
            })
            .andWhere(`${builder.alias}.flags->>'referralToken' = :token`, {
              token,
            });

          return builder;
        },
      );
    },
    previewOrganizationSubscriptionUpdate: async (
      _,
      params: z.infer<typeof subscriptionUpdateSchema>,
      ctx: AuthContext,
    ) => {
      const safeParams = subscriptionUpdateSchema.safeParse(params);

      if (safeParams.error) {
        throw safeParams.error;
      }
      const { id, quantity, locale } = safeParams.data;

      await ensureOrganizationRole(ctx, {
        organizationId: id,
        requiredRole: OrganizationMemberRole.Admin,
      });

      const organization = await ctx.con
        .getRepository(Organization)
        .findOneByOrFail({
          id,
        });

      const safeSubscriptionFlags =
        organizationSubscriptionFlagsSchema.safeParse(
          organization.subscriptionFlags,
        );

      if (safeSubscriptionFlags.error) {
        ctx.log.error(
          { err: safeSubscriptionFlags.error, organizationId: id },
          'Invalid organization subscription flags',
        );
        throw safeSubscriptionFlags.error;
      }

      const preview = await fetchSubscriptionUpdatePreview({
        subscriptionId: safeSubscriptionFlags.data.subscriptionId,
        priceId: safeSubscriptionFlags.data.priceId,
        quantity,
      });

      const priceMetadata = await getPricingMetadataByPriceIds(
        ctx,
        preview.items.map((item) => item.price.id),
      );

      const pricing = preview.items.map((item) => {
        const lineItem = preview.recurringTransactionDetails?.lineItems.find(
          (lineItem) => lineItem.priceId === item.price.id,
        );

        if (!lineItem) {
          return {};
        }

        return {
          priceId: item.price.id,
          price: getProductPrice(
            {
              total: parsePaddlePriceInCents(lineItem.unitTotals.total),
              interval: preview.billingCycle?.interval,
            },
            locale,
          ),
          duration: getPricingDuration(item),
          trialPeriod: item.price.trialPeriod,
          currency: {
            code: preview.currencyCode,
          },
          metadata: priceMetadata?.[item.price.id] ?? null,
        };
      });

      const prorated = {
        total: getPrice({
          formatted: parsePaddlePriceInCents(
            preview.immediateTransaction?.details.totals.total,
            0,
          ),
          locale,
        }),
        subTotal: getPrice({
          formatted: parsePaddlePriceInCents(
            preview.immediateTransaction?.details.totals.subtotal,
            0,
          ),
          locale,
        }),
        tax: getPrice({
          formatted: parsePaddlePriceInCents(
            preview.immediateTransaction?.details.totals.tax,
            0,
          ),
          locale,
        }),
      };

      return {
        status: preview.status,
        pricing,
        nextBilling: preview.nextBilledAt,
        prorated,
        total: getPrice({
          formatted: parsePaddlePriceInCents(
            preview.recurringTransactionDetails?.totals.total,
          ),
          locale,
        }),
      };
    },
  },
  Mutation: {
    updateOrganization: async (
      _,
      updateData: z.infer<typeof updateOrganizationSchema>,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      const parseResult = updateOrganizationSchema.safeParse(updateData);
      if (parseResult.error) {
        throw parseResult.error;
      }
      const { id, name, image, externalLocationId } = parseResult.data;

      await ensureOrganizationRole(ctx, {
        organizationId: id,
        requiredRole: OrganizationMemberRole.Admin,
      });

      try {
        const updatePayload: Partial<
          Pick<Organization, 'name' | 'image' | 'locationId'>
        > = {
          name,
        };

        if (image) {
          const { createReadStream } = await image;

          const stream = createReadStream();
          const { url: imageUrl } = await uploadOrganizationImage(id, stream);

          updatePayload.image = imageUrl;
        }

        // Handle location update
        if (externalLocationId) {
          let location = await ctx.con.getRepository(DatasetLocation).findOne({
            where: { externalId: externalLocationId },
          });
          if (!location) {
            location = await createLocationFromMapbox(
              ctx.con,
              externalLocationId,
            );
          }

          if (location) {
            updatePayload.locationId = location.id;
          }
        } else {
          // If externalLocationId is explicitly null, clear the locationId
          updatePayload.locationId = null;
        }

        await ctx.con.getRepository(Organization).update(id, updatePayload);

        return getOrganizationById(ctx, info, id);
      } catch (_err) {
        const err = _err as Error;
        ctx.log.error(
          { err, organizationId: id },
          'Failed to update organization',
        );
        throw err;
      }
    },
    joinOrganization: async (
      _,
      { id: organizationId, token },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      await verifyOrganizationInviter(ctx, organizationId, token);

      try {
        await ctx.con.transaction(async (manager) => {
          const member = await manager.getRepository(User).findOneByOrFail({
            id: ctx.userId,
          });

          const organization = await manager
            .getRepository(Organization)
            .findOneByOrFail({
              id: organizationId,
            });

          const isPlus = isPlusMember(member.subscriptionFlags?.cycle);

          await Promise.all([
            manager.getRepository(ContentPreferenceOrganization).save({
              userId: member.id,
              referenceId: organizationId,
              organizationId: organizationId,
              feedId: member.id,
              status: isPlus
                ? ContentPreferenceOrganizationStatus.Free
                : ContentPreferenceOrganizationStatus.Plus,
              flags: {
                role: OrganizationMemberRole.Member,
                referralToken: randomUUID(),
              },
            }),
            // Give the user plus access if they are not already a plus member
            !isPlus &&
              manager.getRepository(User).update(
                { id: member.id },
                {
                  subscriptionFlags: updateSubscriptionFlags({
                    ...organization.subscriptionFlags,
                    organizationId: organizationId,
                  }),
                },
              ),
          ]);

          notifyOrganizationUserJoined(ctx.log, {
            memberId: member.id,
            organizationId: organization.id,
          });
        });
      } catch (_err) {
        const err = _err as TypeORMQueryFailedError;

        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw err;
        }
      }

      return getOrganizationById(ctx, info, organizationId);
    },
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

          notifyOrganizationUserLeft(ctx.log, {
            memberId: member.id,
            organizationId,
          });
        });
      } catch (_err) {
        const err = _err as TypeORMQueryFailedError;
        throw err;
      }
      return { _: true };
    },
    updateOrganizationSubscription: async (
      _,
      params: z.infer<typeof subscriptionUpdateSchema>,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      const safeParams = subscriptionUpdateSchema.safeParse(params);

      if (safeParams.error) {
        throw safeParams.error;
      }
      const { id, quantity } = safeParams.data;

      await ensureOrganizationRole(ctx, {
        organizationId: id,
        requiredRole: OrganizationMemberRole.Owner,
      });

      const organization = await ctx.con
        .getRepository(Organization)
        .findOneByOrFail({
          id,
        });

      const safeSubscriptionFlags =
        organizationSubscriptionFlagsSchema.safeParse(
          organization.subscriptionFlags,
        );

      if (safeSubscriptionFlags.error) {
        ctx.log.error(
          { err: safeSubscriptionFlags.error, organizationId: id },
          'Invalid organization subscription flags',
        );
        throw safeSubscriptionFlags.error;
      }

      const { data: subscriptionFlags } = safeSubscriptionFlags;

      if (subscriptionFlags.status !== SubscriptionStatus.Active) {
        throw new Error(
          'Organization subscription is not active. Cannot update subscription.',
        );
      }

      try {
        const updateResult = await updateOrganizationSubscription({
          subscriptionId: subscriptionFlags.subscriptionId,
          priceId: subscriptionFlags.priceId,
          quantity,
        });

        await ctx.con.getRepository(Organization).update(id, {
          seats: updateResult.items[0].quantity,
        });
      } catch (_err) {
        const err = _err as Error;
        ctx.log.error(
          { err, organizationId: id, quantity },
          'Failed to update organization subscription',
        );
        throw err;
      }

      return getOrganizationById(ctx, info, id);
    },
    deleteOrganization: async (_, { id }, ctx: AuthContext) => {
      await ensureOrganizationRole(ctx, {
        organizationId: id,
        requiredRole: OrganizationMemberRole.Owner,
      });

      const organization = await ctx.con
        .getRepository<
          Pick<Organization, 'id' | 'subscriptionFlags' | 'members'>
        >(Organization)
        .findOneOrFail({
          select: {
            id: true,
            subscriptionFlags: true,
            members: {
              userId: true,
              status: true,
            },
          },
          where: { id },
          relations: {
            members: true,
          },
        });

      if (
        organization.subscriptionFlags?.status === SubscriptionStatus.Active
      ) {
        throw new ForbiddenError(
          'Cannot delete organization with an active subscription. Please cancel the subscription first.',
        );
      }

      const members: Pick<
        ContentPreferenceOrganization,
        'userId' | 'status'
      >[] = await organization.members;

      if (
        members.some(
          (m) => m.status === ContentPreferenceOrganizationStatus.Plus,
        )
      ) {
        throw new ForbiddenError(
          'Cannot delete organization with Plus members. Please remove all Plus members first.',
        );
      }

      await ctx.con.getRepository(Organization).delete(id);

      return { _: true };
    },
    removeOrganizationMember: async (
      _,
      { id: organizationId, memberId },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      await ensureOrganizationRole(ctx, {
        organizationId,
        requiredRole: OrganizationMemberRole.Admin,
      });

      if (memberId === ctx.userId) {
        throw new ForbiddenError(
          'You cannot remove yourself from the organization.',
        );
      }

      await ctx.con.transaction(async (manager) => {
        const member = await manager
          .getRepository(ContentPreferenceOrganization)
          .findOneOrFail({
            where: {
              organizationId,
              userId: memberId,
            },
            relations: {
              user: true,
            },
          });

        if (member.flags?.role === OrganizationMemberRole.Owner) {
          throw new ForbiddenError(
            'You cannot remove the owner of the organization.',
          );
        }

        const memberUser = await member.user;

        const organizationSeatUser =
          memberUser.subscriptionFlags?.organizationId === organizationId;

        await Promise.all([
          manager.getRepository(ContentPreferenceOrganization).delete({
            userId: memberId,
            organizationId,
          }),
          organizationSeatUser &&
            manager.getRepository(User).update(
              { id: memberId },
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

      notifyOrganizationUserRemoved(ctx.log, { memberId, organizationId });
      return getOrganizationById(ctx, info, organizationId);
    },
    updateOrganizationMemberRole: async (
      _,
      {
        id: organizationId,
        memberId,
        role,
      }: { id: string; memberId: string; role: OrganizationMemberRole },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserOrganization> => {
      await ensureOrganizationRole(ctx, {
        organizationId,
        requiredRole: OrganizationMemberRole.Admin,
      });

      await ctx.con.transaction(async (manager) => {
        if (role === OrganizationMemberRole.Owner) {
          throw new ForbiddenError(
            'You cannot assign the owner role to a member at this time.',
          );
        }

        if (memberId === ctx.userId) {
          throw new ForbiddenError(
            'You cannot change your own role in the organization.',
          );
        }

        const member = await manager
          .getRepository(ContentPreferenceOrganization)
          .findOneByOrFail({
            organizationId,
            userId: memberId,
          });

        if (member.flags?.role === OrganizationMemberRole.Owner) {
          throw new ForbiddenError(
            'You cannot change the role of the owner of the organization.',
          );
        }

        await manager.getRepository(ContentPreferenceOrganization).update(
          {
            userId: memberId,
            organizationId,
          },
          {
            flags: updateFlagsStatement({
              role,
            }),
          },
        );
      });

      return getOrganizationById(ctx, info, organizationId);
    },
    toggleOrganizationMemberSeat: async (
      _,
      { id: organizationId, memberId },
      ctx: AuthContext,
      info,
    ) => {
      await ensureOrganizationRole(ctx, {
        organizationId,
        requiredRole: OrganizationMemberRole.Admin,
      });

      try {
        await ctx.con.transaction(async (manager) => {
          const member = await manager
            .getRepository(ContentPreferenceOrganization)
            .findOneOrFail({
              where: {
                organizationId,
                userId: memberId,
              },
              relations: {
                user: true,
                organization: true,
              },
            });

          const activeSeats = await manager
            .getRepository(ContentPreferenceOrganization)
            .count({
              where: {
                organizationId,
                status: ContentPreferenceOrganizationStatus.Plus,
              },
            });

          const user = await member.user;
          const organization = await member.organization;

          const isPlus = isPlusMember(user.subscriptionFlags?.cycle);
          const hasPlusSeat =
            member.status === ContentPreferenceOrganizationStatus.Plus;

          if (isPlus && !hasPlusSeat) {
            throw new ForbiddenError(
              'You cannot toggle the seat of a member who has a Plus subscription from outside the organization.',
            );
          }

          if (!isPlus && !hasPlusSeat && activeSeats >= organization.seats) {
            throw new ForbiddenError(
              'You cannot assign a seat to a member when the organization has reached its maximum number of seats.',
            );
          }

          await Promise.all([
            manager.getRepository(User).update(
              { id: memberId },
              {
                subscriptionFlags: updateSubscriptionFlags(
                  isPlus && hasPlusSeat
                    ? {
                        subscriptionId: null,
                        cycle: null,
                        createdAt: null,
                        provider: null,
                        status: null,
                        organizationId: null,
                      }
                    : {
                        ...organization.subscriptionFlags,
                        organizationId: organizationId,
                      },
                ),
              },
            ),
            manager.getRepository(ContentPreferenceOrganization).update(
              {
                userId: memberId,
                organizationId,
              },
              {
                status:
                  isPlus && hasPlusSeat
                    ? ContentPreferenceOrganizationStatus.Free
                    : ContentPreferenceOrganizationStatus.Plus,
              },
            ),
          ]);
        });

        return getOrganizationById(ctx, info, organizationId);
      } catch (_err) {
        const err = _err as Error;
        ctx.log.error(
          { err, organizationId, memberId },
          'Failed to toggle organization member seat',
        );
        throw err;
      }
    },
  },
  OrganizationMember: {
    lastActive: async (
      organizationMember: GQLOrganizationMember,
      _,
      ctx: Context,
    ) => {
      if (!organizationMember.userId) {
        return null;
      }
      return await ctx.dataLoader.userLastActive.load({
        userId: organizationMember.userId,
      });
    },
  },
});
