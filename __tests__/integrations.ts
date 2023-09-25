import { faker } from '@faker-js/faker';
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
  const randomDate = (): Date => faker.date.past();
  integrations = Array.from(Array(5))
    .map(() =>
      con.getRepository(Integration).create({
        timestamp: randomDate(),
        logo: faker.image.url(),
        title: faker.lorem.word(),
        subtitle: faker.lorem.word(),
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

  it('should return the popular integrations', async () => {
    const expected = integrations.map((i) => _.omit(i, 'timestamp'));

    const res = await client.query(QUERY);
    expect(res.data.popularIntegrations).toEqual(expected);
  });
});
