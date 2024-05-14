import { DataSource } from 'typeorm';
import { User, UserAction, UserActionType } from '../src/entity';
import createOrGetConnection from '../src/db';
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
import { usersFixture } from './fixture/user';

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
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, User, usersFixture);
});

describe('query actions', () => {
  const QUERY = `{
    actions {
      type
      completedAt
    }
  }`;

  it('should return unauthenticated when not logged in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return user completed actions', async () => {
    loggedUser = '1';

    const completedAt = new Date('2020-09-21T07:15:51.247Z');
    const repo = con.getRepository(UserAction);
    const actions = repo.create({
      userId: loggedUser,
      completedAt,
      type: UserActionType.EnableNotification,
    });
    const expected = await repo.save(actions);
    const res = await client.query(QUERY);
    const [action] = res.data.actions;

    const date = new Date(action.completedAt);
    expect(expected.type).toEqual(action.type);
    expect(expected.completedAt.toString()).toEqual(date.toString());
  });
});

describe('mutation completeAction', () => {
  const MUTATION = `
    mutation CompleteAction($type: String!) {
      completeAction(type: $type) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: UserActionType.EnableNotification },
      },
      'UNAUTHENTICATED',
    ));

  it('should record when the action is completed', async () => {
    loggedUser = '1';
    const type = UserActionType.EnableNotification;
    const res = await client.mutate(MUTATION, { variables: { type } });
    const action = await con
      .getRepository(UserAction)
      .findOneBy({ userId: loggedUser, type });
    expect(res.errors).toBeFalsy();
    expect(action.type).toEqual(type);
    expect(action.userId).toEqual(loggedUser);
  });

  it('should ignore when record is already completed', async () => {
    loggedUser = '1';
    const type = UserActionType.EnableNotification;
    await client.mutate(MUTATION, { variables: { type } });
    const action = await con
      .getRepository(UserAction)
      .findOneBy({ userId: loggedUser, type });
    expect(action.type).toEqual(type);
    const res = await client.mutate(MUTATION, { variables: { type } });
    expect(res.errors).toBeFalsy();
  });
});
