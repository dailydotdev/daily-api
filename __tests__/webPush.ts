import {
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
import { Context } from '../src/Context';
import { User } from '../src/entity';
import { usersFixture } from './fixture/user';
import * as OneSignal from '@onesignal/node-onesignal';

const currentSubscriptionId = '11111111-1111-4111-8111-111111111111';
const staleChromeSubscriptionId = '22222222-2222-4222-8222-222222222222';
const staleFirefoxSubscriptionId = '33333333-3333-4333-8333-333333333333';
const staleSafariLegacySubscriptionId = '55555555-5555-4555-8555-555555555555';
const iosSubscriptionId = '44444444-4444-4444-8444-444444444444';

const MUTATION = /* GraphQL */ `
  mutation SyncWebPushSubscription($input: SyncWebPushSubscriptionInput!) {
    syncWebPushSubscription(input: $input) {
      cleanedUpSubscriptions
    }
  }
`;

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | undefined;
let originalOneSignalAppId: string | undefined;
let originalOneSignalApiKey: string | undefined;
let originalOneSignalWebAppId: string | undefined;
let originalOneSignalWebApiKey: string | undefined;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser) as unknown as Context,
  );
  client = state.client;
  originalOneSignalAppId = process.env.ONESIGNAL_APP_ID;
  originalOneSignalApiKey = process.env.ONESIGNAL_API_KEY;
  originalOneSignalWebAppId = process.env.ONESIGNAL_WEB_APP_ID;
  originalOneSignalWebApiKey = process.env.ONESIGNAL_WEB_API_KEY;
});

beforeEach(async () => {
  loggedUser = undefined;
  process.env.ONESIGNAL_APP_ID = '00000000-0000-4000-8000-000000000000';
  process.env.ONESIGNAL_API_KEY = 'test-key';
  process.env.ONESIGNAL_WEB_APP_ID = '99999999-9999-4999-8999-999999999999';
  process.env.ONESIGNAL_WEB_API_KEY = 'test-web-key';
  jest.restoreAllMocks();
  await saveFixtures(con, User, usersFixture);
});

afterAll(async () => {
  if (originalOneSignalAppId) {
    process.env.ONESIGNAL_APP_ID = originalOneSignalAppId;
  } else {
    Reflect.deleteProperty(process.env, 'ONESIGNAL_APP_ID');
  }

  if (originalOneSignalApiKey) {
    process.env.ONESIGNAL_API_KEY = originalOneSignalApiKey;
  } else {
    Reflect.deleteProperty(process.env, 'ONESIGNAL_API_KEY');
  }

  if (originalOneSignalWebAppId) {
    process.env.ONESIGNAL_WEB_APP_ID = originalOneSignalWebAppId;
  } else {
    Reflect.deleteProperty(process.env, 'ONESIGNAL_WEB_APP_ID');
  }

  if (originalOneSignalWebApiKey) {
    process.env.ONESIGNAL_WEB_API_KEY = originalOneSignalWebApiKey;
  } else {
    Reflect.deleteProperty(process.env, 'ONESIGNAL_WEB_API_KEY');
  }

  await disposeGraphQLTesting(state);
});

describe('mutation syncWebPushSubscription', () => {
  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          input: {
            subscriptionId: currentSubscriptionId,
            origin: 'https://daily.dev',
          },
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should delete stale web subscriptions only', async () => {
    loggedUser = '1';
    const fetchUserMock = jest
      .spyOn(OneSignal.DefaultApi.prototype, 'fetchUser')
      .mockResolvedValue({
        subscriptions: [
          { id: staleChromeSubscriptionId, type: 'ChromePush' },
          { id: staleFirefoxSubscriptionId, type: 'FirefoxPush' },
          { id: staleSafariLegacySubscriptionId, type: 'SafariLegacyPush' },
          { id: iosSubscriptionId, type: 'iOSPush' },
        ],
      } as OneSignal.User);
    const deleteSubscriptionMock = jest
      .spyOn(OneSignal.DefaultApi.prototype, 'deleteSubscription')
      .mockResolvedValue(undefined);

    const res = await client.mutate(MUTATION, {
      variables: {
        input: {
          subscriptionId: currentSubscriptionId,
          origin: 'daily.dev',
        },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data).toEqual({
      syncWebPushSubscription: {
        cleanedUpSubscriptions: 3,
      },
    });

    expect(fetchUserMock).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000000',
      'external_id',
      '1',
    );
    expect(deleteSubscriptionMock.mock.calls.sort()).toEqual([
      ['00000000-0000-4000-8000-000000000000', staleChromeSubscriptionId],
      ['00000000-0000-4000-8000-000000000000', staleFirefoxSubscriptionId],
      ['00000000-0000-4000-8000-000000000000', staleSafariLegacySubscriptionId],
    ]);
  });

  it('should not call OneSignal cleanup when the subscription is opted out', async () => {
    loggedUser = '1';
    const fetchUserMock = jest.spyOn(
      OneSignal.DefaultApi.prototype,
      'fetchUser',
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        input: {
          subscriptionId: currentSubscriptionId,
          origin: 'https://daily.dev',
          optedIn: false,
        },
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data).toEqual({
      syncWebPushSubscription: {
        cleanedUpSubscriptions: 0,
      },
    });

    expect(fetchUserMock).not.toHaveBeenCalled();
  });
});
