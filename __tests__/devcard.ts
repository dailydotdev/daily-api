import nock from 'nock';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { DevCard, DevCardTheme, User } from '../src/entity';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  MockContext,
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  testMutationErrorCode,
} from './helpers';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
const userTimezone = 'Pacific/Midway';

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  nock.cleanAll();

  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      timezone: 'utc',
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      timezone: userTimezone,
    },
    {
      id: '3',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
      timezone: userTimezone,
      username: 'lee',
      twitter: 'lee',
      github: 'lee',
      hashnode: 'lee',
    },
  ]);
});

afterAll(() => disposeGraphQLTesting(state));

describe('mutation generateDevCard', () => {
  const MUTATION = `mutation GenerateDevCard($theme: DevCardTheme, $type: DevCardType, $isProfileCover: Boolean, $showBorder: Boolean){
    generateDevCard(theme: $theme, type: $type, isProfileCover: $isProfileCover, showBorder: $showBorder) {
      imageUrl
    }
  }`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'UNAUTHENTICATED',
    ));

  it('should generate new dev card', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(`http://localhost:3000/devcards/${devCards[0].id}.png\\?r=.*`),
    );
  });

  it('should generate new dev card based on theme', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { theme: DevCardTheme.Gold.toLocaleUpperCase() },
    });
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(devCards[0].theme).toEqual(DevCardTheme.Gold);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(`http://localhost:3000/devcards/${devCards[0].id}.png\\?r=.*`),
    );
  });

  it('should use an existing dev card entity', async () => {
    loggedUser = '1';
    await con.getRepository(DevCard).insert({ userId: '1' });
    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(`http://localhost:3000/devcards/${devCards[0].id}.png\\?r=.*`),
    );
  });
});
