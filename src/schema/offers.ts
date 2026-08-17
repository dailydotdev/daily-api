import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext } from '../Context';
import { ONE_HOUR_IN_SECONDS } from '../common/constants';
import { confirmOffersDeliveredSchema } from '../common/schema/offers';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { encoreClient } from '../integrations/encore/clients';
import type { EncoreOffer } from '../integrations/encore/types';
import { isMockEnabled } from '../mocks/common';
import { mockEncoreOffersFeedResponse } from '../mocks/encore/offers';
import {
  deleteRedisKey,
  getRedisObject,
  setRedisObjectWithExpiry,
} from '../redis';
import { remoteConfig } from '../remoteConfig';
import type { GQLEmptyResponse } from './common';

export const typeDefs = /* GraphQL */ `
  """
  The product moment an offer is requested for. Encore's feed API has no
  placement concept yet — this keys config/logging and future branching.
  """
  enum OfferPlacement {
    STREAK_MILESTONE
  }

  """
  A sponsored partner offer served via Encore. clickUrl is a tokenized,
  short-lived attribution link — offers must never be cached or reused
  across sessions.
  """
  type UserOffer {
    impressionUid: ID!
    clickUrl: String!
    title: String!
    description: String
    imageUrl: String
    advertiserName: String!
    advertiserLogo: String
    perk: String
    badgeLabel: String
  }

  extend type Query {
    """
    Fresh sponsored offers for the given placement. Empty when offers are
    disabled, unavailable, or the user's region is not eligible.
    """
    userOffers(placement: OfferPlacement!): [UserOffer!]!
      @auth
      @rateLimit(limit: 10, duration: 60)
  }

  extend type Mutation {
    """
    Confirms offers were actually rendered to the user (render-then-confirm).
    Unknown or already-confirmed impression uids are ignored.
    """
    confirmOffersDelivered(impressionUids: [ID!]!): EmptyResponse
      @auth
      @rateLimit(limit: 10, duration: 60)
  }
`;

const offersFeedLimit = 3;

// Ownership markers outlive the popup moment but not the tokenized links.
const impressionTtlSeconds = ONE_HOUR_IN_SECONDS;

const impressionKey = (impressionUid: string): string =>
  generateStorageKey(StorageTopic.Boot, StorageKey.Offers, impressionUid);

const parseLanguage = (acceptLanguage: string): string => {
  const primary = acceptLanguage.split(',')[0]?.trim().split(';')[0];
  const tag = primary?.split('-')[0]?.toLowerCase() ?? '';
  return /^[a-z]{2,3}$/.test(tag) ? tag : 'en';
};

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    userOffers: async (
      _,
      args: { placement: string },
      ctx: AuthContext,
    ): Promise<EncoreOffer[]> => {
      const mocked = isMockEnabled();
      const config = remoteConfig.vars.encoreOffers;

      if (!mocked && !config?.enabled) {
        return [];
      }

      if (
        !mocked &&
        config?.allowedCountries?.length &&
        !config.allowedCountries.includes(ctx.region)
      ) {
        return [];
      }

      // Encore requires an ISO country code; without geo we'd misattribute
      // offers, so serve none. Local dev has no GeoIP database, so it
      // defaults to US to keep the flow testable against Encore's test env.
      const countryCode =
        ctx.region || (process.env.NODE_ENV === 'development' ? 'US' : '');

      if (!mocked && !countryCode) {
        return [];
      }

      try {
        const response = mocked
          ? mockEncoreOffersFeedResponse
          : await encoreClient.getOffersFeed({
              userId: ctx.userId,
              limit: offersFeedLimit,
              attributes: {
                countryCode,
                language: parseLanguage(ctx.requestMeta.acceptLanguage),
                platform: 'web',
              },
            });
        const offers = response.offers ?? [];

        // Ownership markers let confirmOffersDelivered verify the impression
        // uid was actually served to this user (and gives us the idempotency
        // Encore's delivered endpoint doesn't).
        await Promise.all(
          offers.map((offer) =>
            setRedisObjectWithExpiry(
              impressionKey(offer.impressionUid),
              ctx.userId,
              impressionTtlSeconds,
            ),
          ),
        );

        return offers;
      } catch (err) {
        ctx.log.error(
          { err, userId: ctx.userId, placement: args.placement },
          'failed to fetch encore offers',
        );
        return [];
      }
    },
  },
  Mutation: {
    confirmOffersDelivered: async (
      _,
      args: { impressionUids: string[] },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { impressionUids } = confirmOffersDeliveredSchema.parse(args);
      const deliveredTimestamp = Math.floor(Date.now() / 1000);
      const mocked = isMockEnabled();

      await Promise.all(
        impressionUids.map(async (impressionUid) => {
          const key = impressionKey(impressionUid);
          const owner = await getRedisObject(key);

          if (owner !== ctx.userId) {
            return;
          }

          // Delete before confirming: Encore doesn't dedupe delivered calls,
          // so a lost confirm beats a duplicated one.
          await deleteRedisKey(key);

          if (mocked) {
            return;
          }

          try {
            await encoreClient.confirmDelivered(
              impressionUid,
              deliveredTimestamp,
            );
          } catch (err) {
            ctx.log.error(
              { err, userId: ctx.userId, impressionUid },
              'failed to confirm encore offer delivery',
            );
          }
        }),
      );

      return { _: true };
    },
  },
};
