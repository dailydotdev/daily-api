import { Alerts, ALERTS_DEFAULT } from '../src/entity';
import { Connection, getConnection } from 'typeorm';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testMutationErrorCode,
} from './helpers';

let con: Connection;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = getConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;
});

describe('query userAlerts', () => {
  const QUERY = `{
    userAlerts {
      filter
      rankLastSeen
    }
  }`;

  it('should return alerts default values if anonymous', async () => {
    const res = await client.query(QUERY);

    expect(res.data.userAlerts).toEqual(ALERTS_DEFAULT);
  });

  it('should return user alerts', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Alerts);
    const alerts = repo.create({
      userId: '1',
      filter: true,
    });
    const expected = await repo.save(alerts);
    const res = await client.query(QUERY);

    delete expected.userId;

    expect(res.data.userAlerts).toEqual(expected);
  });
});

describe('mutation updateUserAlerts', () => {
  const MUTATION = `
    mutation UpdateUserAlerts($data: UpdateAlertsInput!) {
      updateUserAlerts(data: $data) {
        filter
        rankLastSeen
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { filter: false } },
      },
      'UNAUTHENTICATED',
    ));

  it('should create user alerts when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { data: { filter: false } },
    });
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
      }),
    );

    const rankLastSeen = new Date('2020-09-22T12:15:51.247Z');
    const res = await client.mutate(MUTATION, {
      variables: {
        data: { filter: false, rankLastSeen: rankLastSeen.toISOString() },
      },
    });

    expect(res.data).toMatchSnapshot();
  });
});
