import faker from 'faker';
import _ from 'lodash';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { Integration } from '../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let integrations: Integration[];

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  client = state.client;
});

beforeEach(async () => {
  const now = new Date();
  const randomDate = (): Date => faker.date.past(null, now);
  integrations = Array.from(Array(5))
    .map(() =>
      con.getRepository(Integration).create({
        timestamp: randomDate(),
        logo: faker.image.imageUrl(),
        title: faker.random.words(1),
        subtitle: faker.random.words(1),
        url: faker.internet.url(),
      }),
    )
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  await con.getRepository(Integration).save(integrations);
});

afterAll(() => disposeGraphQLTesting(state));

describe('query popularIntegrations', () => {
  const QUERY = `{
  popularIntegrations {
    logo, title, subtitle, url
  }
}`;

  it('should return the popular routes', async () => {
    const expected = integrations.map((i) => _.omit(i, 'timestamp'));

    const res = await client.query(QUERY);
    expect(res.data.popularIntegrations).toEqual(expected);
  });
});
