import { ALERTS_DEFAULT } from './../src/entity/Alerts';
import { Alerts } from '../src/entity/Alerts';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import { MockContext, testMutationErrorCode } from './helpers';

let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con, loggedUser),
    playground: false,
  });
  client = createTestClient(server);
});

beforeEach(async () => {
  loggedUser = null;
});

describe('query userAlerts', () => {
  const QUERY = `{
    userAlerts {
      filter
    }
  }`;

  it('should return alerts default values if anonymous', async () => {
    const res = await client.query({ query: QUERY });

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
    const res = await client.query({ query: QUERY });

    delete expected.userId;

    expect(res.data.userAlerts).toEqual(expected);
  });
});

describe('mutation updateUserAlerts', () => {
  const MUTATION = `
    mutation UpdateUserAlerts($data: UpdateAlertsInput!) {
      updateUserAlerts(data: $data) {
        filter
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data: { filter: false } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should update alerts of user', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Alerts);
    await repo.save(
      repo.create({
        userId: '1',
        filter: true,
      }),
    );

    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data: { filter: false } },
    });
    expect(res.data).toMatchSnapshot();
  });
});
