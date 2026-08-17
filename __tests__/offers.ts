import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Context } from '../src/Context';
import { User } from '../src/entity';
import { encoreClient } from '../src/integrations/encore/clients';
import { mockEncoreOffersFeedResponse } from '../src/mocks/encore/offers';
import { deleteKeysByPattern, getRedisObject } from '../src/redis';
import { remoteConfig } from '../src/remoteConfig';
import { usersFixture } from './fixture/user';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';

const QUERY = /* GraphQL */ `
  query UserOffers($placement: OfferPlacement!) {
    userOffers(placement: $placement) {
      impressionUid
      clickUrl
      title
      description
      imageUrl
      advertiserName
      advertiserLogo
      perk
      badgeLabel
    }
  }
`;

const MUTATION = /* GraphQL */ `
  mutation ConfirmOffersDelivered($impressionUids: [ID!]!) {
    confirmOffersDelivered(impressionUids: $impressionUids) {
      _
    }
  }
`;

const mockOffers = mockEncoreOffersFeedResponse.offers;
const impressionKey = (uid: string) => `boot:offers:${uid}`;

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | undefined;
let region = 'US';

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(
        con,
        loggedUser,
        [],
        undefined,
        false,
        false,
        region,
      ) as unknown as Context,
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = undefined;
  region = 'US';
  jest.restoreAllMocks();
  remoteConfig.vars.encoreOffers = { enabled: true };
  await saveFixtures(con, User, usersFixture);
  await deleteKeysByPattern('boot:offers:*');
});

afterAll(async () => {
  delete remoteConfig.vars.encoreOffers;
  await disposeGraphQLTesting(state);
});

describe('query userOffers', () => {
  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { placement: 'STREAK_MILESTONE' } },
      'UNAUTHENTICATED',
    ));

  it('should return empty list when offers are disabled', async () => {
    loggedUser = '1';
    remoteConfig.vars.encoreOffers = { enabled: false };
    const spy = jest.spyOn(encoreClient, 'getOffersFeed');

    const res = await client.query(QUERY, {
      variables: { placement: 'STREAK_MILESTONE' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOffers).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should return empty list when region is not allowed', async () => {
    loggedUser = '1';
    region = 'DE';
    remoteConfig.vars.encoreOffers = {
      enabled: true,
      allowedCountries: ['US', 'GB'],
    };
    const spy = jest.spyOn(encoreClient, 'getOffersFeed');

    const res = await client.query(QUERY, {
      variables: { placement: 'STREAK_MILESTONE' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOffers).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should return empty list when region is unknown', async () => {
    loggedUser = '1';
    region = '';
    const spy = jest.spyOn(encoreClient, 'getOffersFeed');

    const res = await client.query(QUERY, {
      variables: { placement: 'STREAK_MILESTONE' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOffers).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should return offers and store ownership markers', async () => {
    loggedUser = '1';
    const spy = jest
      .spyOn(encoreClient, 'getOffersFeed')
      .mockResolvedValue(mockEncoreOffersFeedResponse);

    const res = await client.query(QUERY, {
      variables: { placement: 'STREAK_MILESTONE' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOffers).toEqual(
      mockOffers.map((offer) => ({
        impressionUid: offer.impressionUid,
        clickUrl: offer.clickUrl,
        title: offer.title,
        description: offer.description,
        imageUrl: offer.imageUrl,
        advertiserName: offer.advertiserName,
        advertiserLogo: offer.advertiserLogo,
        perk: offer.perk,
        badgeLabel: offer.badgeLabel,
      })),
    );
    expect(spy).toHaveBeenCalledWith({
      userId: '1',
      limit: 3,
      attributes: expect.objectContaining({
        countryCode: 'US',
        platform: 'web',
      }),
    });
    await Promise.all(
      mockOffers.map(async (offer) => {
        expect(await getRedisObject(impressionKey(offer.impressionUid))).toBe(
          '1',
        );
      }),
    );
  });

  it('should return empty list when encore fails', async () => {
    loggedUser = '1';
    jest
      .spyOn(encoreClient, 'getOffersFeed')
      .mockRejectedValue(new Error('encore down'));

    const res = await client.query(QUERY, {
      variables: { placement: 'STREAK_MILESTONE' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOffers).toEqual([]);
  });
});

describe('mutation confirmOffersDelivered', () => {
  const fetchOffers = async () => {
    jest
      .spyOn(encoreClient, 'getOffersFeed')
      .mockResolvedValue(mockEncoreOffersFeedResponse);
    await client.query(QUERY, {
      variables: { placement: 'STREAK_MILESTONE' },
    });
  };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { impressionUids: [mockOffers[0].impressionUid] },
      },
      'UNAUTHENTICATED',
    ));

  it('should reject non-uuid impression uids', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { impressionUids: ['not-a-uuid'] },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should confirm delivery once per impression', async () => {
    loggedUser = '1';
    await fetchOffers();
    const spy = jest
      .spyOn(encoreClient, 'confirmDelivered')
      .mockResolvedValue(undefined);
    const uids = mockOffers.map((offer) => offer.impressionUid);

    const res = await client.mutate(MUTATION, {
      variables: { impressionUids: uids },
    });

    expect(res.errors).toBeFalsy();
    expect(spy).toHaveBeenCalledTimes(uids.length);
    uids.forEach((uid) => {
      expect(spy).toHaveBeenCalledWith(uid, expect.any(Number));
    });
    await Promise.all(
      uids.map(async (uid) => {
        expect(await getRedisObject(impressionKey(uid))).toBeNull();
      }),
    );

    // markers are gone, so a replay must not re-confirm
    const replay = await client.mutate(MUTATION, {
      variables: { impressionUids: uids },
    });
    expect(replay.errors).toBeFalsy();
    expect(spy).toHaveBeenCalledTimes(uids.length);
  });

  it('should skip impressions served to another user', async () => {
    loggedUser = '1';
    await fetchOffers();

    loggedUser = '2';
    const spy = jest
      .spyOn(encoreClient, 'confirmDelivered')
      .mockResolvedValue(undefined);

    const res = await client.mutate(MUTATION, {
      variables: { impressionUids: [mockOffers[0].impressionUid] },
    });

    expect(res.errors).toBeFalsy();
    expect(spy).not.toHaveBeenCalled();
    expect(
      await getRedisObject(impressionKey(mockOffers[0].impressionUid)),
    ).toBe('1');
  });
});
