import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Alerts, ALERTS_DEFAULT, User } from '../../src/entity';
import {
  GraphQLTestingState,
  MockContext,
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  saveFixtures,
} from '../helpers';
import { usersFixture } from '../fixture/user';
import { insertMissingAlerts } from '../../bin/insertMissingAlerts';

let con: DataSource;
let state: GraphQLTestingState;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
});

beforeEach(async () => {
  jest.clearAllMocks();
  await saveFixtures(con, User, usersFixture);
});

afterAll(() => disposeGraphQLTesting(state));

describe('insert missing alerts script', () => {
  it('should insert alerts that does not exist', async () => {
    const users = await con.getRepository(User).find();
    const repo = con.getRepository(Alerts);
    await repo.save({ ...ALERTS_DEFAULT, userId: users[0].id });
    const before = await repo.find();
    expect(before.length).toEqual(1);
    await insertMissingAlerts();
    const alerts = await con.getRepository(Alerts).find();
    expect(alerts.length).toEqual(users.length);
  });
});
