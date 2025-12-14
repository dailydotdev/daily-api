import { FastifyInstance } from 'fastify';
import {
  Alerts,
  ALERTS_DEFAULT,
  User,
  UserAction,
  UserActionType,
} from '../src/entity';
import request from 'supertest';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
} from './helpers';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';
import { saveReturnAlerts } from '../src/schema/alerts';
import { usersFixture } from './fixture/user';
import { isSameDay, subDays } from 'date-fns';
import { opportunitiesFixture } from './fixture/opportunity';
import { OpportunityJob } from '../src/entity/opportunities/OpportunityJob';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
  app = state.app;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;
  await saveFixtures(con, User, usersFixture);
});

describe('query userAlerts', () => {
  const QUERY = /* GraphQL */ `
    {
      userAlerts {
        filter
        rankLastSeen
        myFeed
        companionHelper
        lastChangelog
        lastBanner
        squadTour
        showGenericReferral
        showStreakMilestone
        showRecoverStreak
        lastBootPopup
        lastFeedSettingsFeedback
        showTopReader
        briefBannerLastSeen
        opportunityId
      }
    }
  `;

  it('should return alerts default values if anonymous', async () => {
    const res = await client.query(QUERY);
    res.data.userAlerts.changelog = false;
    res.data.userAlerts.banner = false;
    res.data.userAlerts.bootPopup = false;
    expect(res.data.userAlerts).toEqual({
      ...ALERTS_DEFAULT,
      lastBanner: res.data.userAlerts.lastBanner,
      lastChangelog: res.data.userAlerts.lastChangelog,
      lastFeedSettingsFeedback: res.data.userAlerts.lastFeedSettingsFeedback,
      briefBannerLastSeen: null, // Should be null for anonymous users
      opportunityId: null,
    });
  });

  it('should return user alerts', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Alerts);
    const alerts = repo.create({
      userId: '1',
      filter: true,
      flags: { lastReferralReminder: new Date('2023-02-05 12:00:00') },
    });
    await repo.save(alerts);
    const expected = saveReturnAlerts(
      await repo.findOneByOrFail({ userId: '1' })!,
    );
    const res = await client.query(QUERY);

    delete expected.userId;
    delete expected.flags;

    expect(res.data.userAlerts).toEqual({
      ...expected,
      lastBanner: expected.lastBanner.toISOString(),
      lastChangelog: expected.lastChangelog.toISOString(),
      lastFeedSettingsFeedback: expected.lastFeedSettingsFeedback.toISOString(),
    });
  });

  it('should return briefBannerLastSeen when set', async () => {
    loggedUser = '1';

    const briefBannerLastSeen = new Date('2023-03-15 10:30:00');
    const repo = con.getRepository(Alerts);
    const alerts = repo.create({
      userId: '1',
      briefBannerLastSeen,
    });
    await repo.save(alerts);

    const res = await client.query(QUERY);

    expect(res.data.userAlerts.briefBannerLastSeen).toEqual(
      briefBannerLastSeen.toISOString(),
    );
  });

  it('should return null for briefBannerLastSeen when not set', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Alerts);
    const alerts = repo.create({
      userId: '1',
      filter: true,
    });
    await repo.save(alerts);

    const res = await client.query(QUERY);

    expect(res.data.userAlerts.briefBannerLastSeen).toBeNull();
  });
});

describe('mutation updateUserAlerts', () => {
  const MUTATION = (extra = '') => /* GraphQL */ `
    mutation UpdateUserAlerts($data: UpdateAlertsInput!) {
      updateUserAlerts(data: $data) {
        filter
        rankLastSeen
        myFeed
        companionHelper
        squadTour
        ${extra}
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION(),
        variables: { data: { filter: false } },
      },
      'UNAUTHENTICATED',
    ));

  it('should create user alerts when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION(), {
      variables: { data: { filter: false } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should create user action type for my feed if alert is false', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION(), {
      variables: { data: { filter: false } },
    });
    const completed = await con
      .getRepository(UserAction)
      .findOneBy({ userId: '1', type: UserActionType.MyFeed });
    expect(completed).toBeTruthy();
    expect(res.data).toMatchSnapshot();
  });

  it('should update alerts of user', async () => {
    loggedUser = '1';

    const rankLastSeenOld = new Date('2020-09-21T07:15:51.247Z');
    const repo = con.getRepository(Alerts);
    await repo.save(
      repo.create({
        userId: '1',
        filter: true,
        rankLastSeen: rankLastSeenOld,
        myFeed: 'created',
        companionHelper: true,
        squadTour: true,
      }),
    );

    const rankLastSeen = new Date('2020-09-22T12:15:51.247Z');
    const res = await client.mutate(MUTATION(), {
      variables: {
        data: {
          rankLastSeen: rankLastSeen.toISOString(),
          myFeed: 'created',
          companionHelper: false,
          squadTour: false,
        },
      },
    });
    const completed = await con
      .getRepository(UserAction)
      .findOneBy({ userId: '1', type: UserActionType.MyFeed });

    expect(completed).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should not update showGenericReferral alerts of user via updateAlerts', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION('showGenericReferral'), {
      variables: { data: { showGenericReferral: false } },
    });
    expect(res.errors).toBeTruthy();
    expect(res.errors[0].message).toEqual('Unexpected error');
  });

  it('should update briefBannerLastSeen alert of user', async () => {
    loggedUser = '1';

    const briefBannerLastSeen = new Date('2023-03-15 14:30:00');
    const res = await client.mutate(MUTATION('briefBannerLastSeen'), {
      variables: {
        data: {
          briefBannerLastSeen: briefBannerLastSeen.toISOString(),
        },
      },
    });

    expect(res.errors).toBeFalsy();

    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts?.briefBannerLastSeen).toEqual(briefBannerLastSeen);

    // Verify the response includes the updated value
    const queryRes = await client.query(`{
      userAlerts {
        briefBannerLastSeen
      }
    }`);
    expect(queryRes.data.userAlerts.briefBannerLastSeen).toEqual(
      briefBannerLastSeen.toISOString(),
    );
  });
});

describe('dedicated api routes', () => {
  describe('GET /alerts', () => {
    it('should return user alerts', async () => {
      const repo = con.getRepository(Alerts);
      const alerts = repo.create({
        userId: '1',
        myFeed: 'created',
      });
      await repo.save(alerts);
      const expected = saveReturnAlerts(
        await repo.findOneByOrFail({ userId: '1' })!,
      );
      delete expected['userId'];
      delete expected['flags'];

      loggedUser = '1';
      const res = await authorizeRequest(
        request(app.server).get('/alerts'),
      ).expect(200);
      expect(res.body).toEqual({
        ...expected,
        lastBanner: expected['lastBanner'].toISOString(),
        lastChangelog: expected['lastChangelog'].toISOString(),
        lastFeedSettingsFeedback:
          expected['lastFeedSettingsFeedback'].toISOString(),
      });
    });

    it('should return briefBannerLastSeen in REST API', async () => {
      const briefBannerLastSeen = new Date('2023-03-15 16:45:00');
      const repo = con.getRepository(Alerts);
      const alerts = repo.create({
        userId: '1',
        briefBannerLastSeen,
      });
      await repo.save(alerts);

      loggedUser = '1';
      const res = await authorizeRequest(
        request(app.server).get('/alerts'),
      ).expect(200);

      expect(res.body.briefBannerLastSeen).toEqual(
        briefBannerLastSeen.toISOString(),
      );
    });
  });
});

describe('mutation updateLastReferralReminder', () => {
  const MUTATION = /* GraphQL */ `
    mutation UpdateLastReferralReminder {
      updateLastReferralReminder {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'UNAUTHENTICATED',
    ));

  it('should update the last referral reminder and flags', async () => {
    loggedUser = '1';
    const date = new Date();
    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.showGenericReferral).toEqual(false);
    expect(alerts.flags.lastReferralReminder).not.toBeNull();
    expect(
      new Date(alerts.flags.lastReferralReminder).getTime(),
    ).toBeGreaterThanOrEqual(+date);
  });

  it('should update the last referral reminder and flags but keep existing flags', async () => {
    loggedUser = '1';

    // eslint-disable-next-line
    // @ts-ignore
    await con.getRepository(Alerts).save({
      userId: loggedUser,
      flags: { existingFlag: 'value1' },
    });

    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.showGenericReferral).toEqual(false);
    expect(alerts.flags).toEqual({
      existingFlag: 'value1',
      lastReferralReminder: alerts.flags.lastReferralReminder,
    });
  });
});

describe('updateFeedFeedbackReminder', () => {
  const MUTATION = /* GraphQL */ `
    mutation UpdateFeedFeedbackReminder {
      updateFeedFeedbackReminder {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(client, { mutation: MUTATION }, 'UNAUTHENTICATED'));

  it('should reset the feed settings feedback reminder', async () => {
    loggedUser = '1';

    await con
      .getRepository(Alerts)
      .update(
        { userId: '1' },
        { lastFeedSettingsFeedback: subDays(new Date(), 1) },
      );

    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.lastFeedSettingsFeedback).toBeTruthy();
    expect(isSameDay(alerts.lastFeedSettingsFeedback, new Date())).toBeTruthy();
  });
});

describe('mutation clearOpportunityAlert', () => {
  const MUTATION = /* GraphQL */ `
    mutation ClearOpportunityAlert {
      clearOpportunityAlert {
        _
      }
    }
  `;
  it('should not authorize when not logged in', () =>
    testMutationErrorCode(client, { mutation: MUTATION }, 'UNAUTHENTICATED'));

  it('should clear opportunityId from alerts', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityJob, [
      {
        ...opportunitiesFixture[0],
        id: '45bef485-ba42-4fd9-8c8c-a2ea4b2d1d62',
        organizationId: undefined,
      },
    ]);

    await con.getRepository(Alerts).save(
      con.getRepository(Alerts).create({
        userId: '1',
        opportunityId: '45bef485-ba42-4fd9-8c8c-a2ea4b2d1d62',
      }),
    );

    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const alerts = await con
      .getRepository(Alerts)
      .findOneByOrFail({ userId: '1' });
    expect(alerts.opportunityId).toBeNull();
  });
});

describe('mutation updateHasSeenOpportunity', () => {
  const MUTATION = (hasSeenOpportunity?: boolean) => /* GraphQL */ `
    mutation UpdateHasSeenOpportunity {
      updateHasSeenOpportunity${hasSeenOpportunity !== undefined ? `(hasSeenOpportunity: ${hasSeenOpportunity})` : ''} {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(client, { mutation: MUTATION() }, 'UNAUTHENTICATED'));

  it('should set hasSeenOpportunity flag to true by default', async () => {
    loggedUser = '1';

    await con.getRepository(Alerts).save(
      con.getRepository(Alerts).create({
        userId: '1',
        flags: { hasSeenOpportunity: false },
      }),
    );

    const res = await client.mutate(MUTATION());
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.flags.hasSeenOpportunity).toBe(true);
  });

  it('should set hasSeenOpportunity flag to true when explicitly passed', async () => {
    loggedUser = '1';

    await con.getRepository(Alerts).save(
      con.getRepository(Alerts).create({
        userId: '1',
        flags: { hasSeenOpportunity: false },
      }),
    );

    const res = await client.mutate(MUTATION(true));
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.flags.hasSeenOpportunity).toBe(true);
  });

  it('should set hasSeenOpportunity flag to false when passed', async () => {
    loggedUser = '1';

    await con.getRepository(Alerts).save(
      con.getRepository(Alerts).create({
        userId: '1',
        flags: { hasSeenOpportunity: true },
      }),
    );

    const res = await client.mutate(MUTATION(false));
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.flags.hasSeenOpportunity).toBe(false);
  });

  it('should preserve existing flags when updating hasSeenOpportunity', async () => {
    loggedUser = '1';

    const lastReferralDate = new Date('2023-02-05 12:00:00');
    await con.getRepository(Alerts).save(
      con.getRepository(Alerts).create({
        userId: '1',
        flags: {
          hasSeenOpportunity: false,
          lastReferralReminder: lastReferralDate,
        },
      }),
    );

    const res = await client.mutate(MUTATION(true));
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.flags.hasSeenOpportunity).toBe(true);
    // JSONB stores dates as ISO strings
    expect(alerts.flags.lastReferralReminder).toEqual(
      lastReferralDate.toISOString(),
    );
  });

  it('should work when alerts record does not have flags set', async () => {
    loggedUser = '1';

    await con.getRepository(Alerts).save(
      con.getRepository(Alerts).create({
        userId: '1',
      }),
    );

    const res = await client.mutate(MUTATION());
    expect(res.errors).toBeFalsy();
    const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alerts.flags.hasSeenOpportunity).toBe(true);
  });
});
