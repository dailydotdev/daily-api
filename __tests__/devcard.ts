import nock from 'nock';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import createOrGetConnection from '../src/db';
import { DevCard, DevCardTheme, User } from '../src/entity';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  MockContext,
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  testMutationErrorCode,
  testQueryError,
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
      username: 'ido',
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
  const MUTATION = `mutation GenerateDevCard($file: Upload, $url: String){
    generateDevCard(file: $file, url: $url) {
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

  it('should not validate passed url', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { url: 'hh::/not-a-valid-url.test' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should generate new dev card', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/${devCards[0].id.replace(
          /-/g,
          '',
        )}.png\\?r=.*`,
      ),
    );
  });

  it('should generate new dev card based from the url', async () => {
    loggedUser = '1';
    const url =
      'https://daily-now-res.cloudinary.com/image/upload/v1634801813/devcard/bg/halloween.jpg';
    const res = await client.mutate(MUTATION, { variables: { url } });
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCard.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/${devCards[0].id.replace(
          /-/g,
          '',
        )}.png\\?r=.*`,
      ),
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
      new RegExp(
        `http://localhost:4000/devcards/${devCards[0].id.replace(
          /-/g,
          '',
        )}.png\\?r=.*`,
      ),
    );
  });
});

describe('mutation generateDevCardV2', () => {
  const MUTATION = `mutation GenerateDevCard($theme: DevCardTheme, $type: DevCardType, $isProfileCover: Boolean, $showBorder: Boolean){
    generateDevCardV2(theme: $theme, type: $type, isProfileCover: $isProfileCover, showBorder: $showBorder) {
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
    expect(res.data.generateDevCardV2.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/v2/${devCards[0].userId}.png\\?r=.*`,
      ),
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
    expect(res.data.generateDevCardV2.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/v2/${devCards[0].userId}.png\\?r=.*`,
      ),
    );
  });

  it('should generate new dev card based on type', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { theme: DevCardTheme.Gold.toLocaleUpperCase(), type: 'X' },
    });
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(devCards[0].theme).toEqual(DevCardTheme.Gold);
    expect(res.data.generateDevCardV2.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/v2/${devCards[0].userId}.png\\?type=x&r=.*`,
      ),
    );
  });

  it('should use an existing dev card entity', async () => {
    loggedUser = '1';
    await con.getRepository(DevCard).insert({ userId: '1' });
    const res = await client.mutate(MUTATION);
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(res.data.generateDevCardV2.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/v2/${devCards[0].userId}.png\\?r=.*`,
      ),
    );
  });

  it('updates an existing dev card entity', async () => {
    loggedUser = '1';
    await con
      .getRepository(DevCard)
      .insert({ userId: '1', theme: DevCardTheme.Gold });
    const res = await client.mutate(MUTATION, {
      variables: { theme: DevCardTheme.Silver.toLocaleUpperCase() },
    });
    expect(res.errors).toBeFalsy();
    const devCards = await con.getRepository(DevCard).find();
    expect(devCards.length).toEqual(1);
    expect(devCards[0].theme).toEqual(DevCardTheme.Silver);
    expect(res.data.generateDevCardV2.imageUrl).toMatch(
      new RegExp(
        `http://localhost:4000/devcards/v2/${devCards[0].userId}.png\\?r=.*`,
      ),
    );
  });
});

describe('query devCard(id)', () => {
  const QUERY = `query DevCardByUserId($id: ID!) {
    devCard(id: $id) {
      id
      user {
        ...UserShortInfo
      }
      createdAt
      theme
      isProfileCover
      showBorder
      articlesRead
      tags
    }
  }

  fragment UserShortInfo on User {
    id
    name
    image
    permalink
    username
    bio
    reputation
  }
`;

  const userId = '1';
  const devCardId = uuidv4();

  beforeEach(async () => {
    await con.getRepository(DevCard).save({
      id: devCardId,
      userId,
      theme: DevCardTheme.Gold,
      isProfileCover: true,
      showBorder: false,
    });
  });

  it('query is public, no auth required', () =>
    testQueryError(
      client,
      {
        query: QUERY,
        variables: { id: userId },
      },
      (errors) => {
        expect(errors).toBeFalsy();
      },
    ));

  it('should create a new devcard with defaults if none is found', async () => {
    const res = await client.query(QUERY, { variables: { id: '3' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.devCard).toEqual({
      id: expect.any(String),
      user: {
        bio: null,
        id: '3',
        image: 'https://daily.dev/lee.jpg',
        name: 'Lee',
        permalink: 'http://localhost:5002/lee',
        reputation: 10,
        username: 'lee',
      },
      createdAt: expect.any(String),
      theme: DevCardTheme.Default,
      isProfileCover: false,
      showBorder: true,
      articlesRead: 0,
      tags: [],
    });
  });

  it('should return stored devcard', async () => {
    const res = await client.query(QUERY, { variables: { id: userId } });
    expect(res.errors).toBeFalsy();
    expect(res.data.devCard).toEqual({
      id: devCardId,
      user: {
        bio: null,
        id: '1',
        image: 'https://daily.dev/ido.jpg',
        name: 'Ido',
        permalink: 'http://localhost:5002/ido',
        reputation: 10,
        username: 'ido',
      },
      createdAt: expect.any(String),
      theme: DevCardTheme.Gold,
      isProfileCover: true,
      showBorder: false,
      articlesRead: 0,
      tags: [],
    });
  });
});
