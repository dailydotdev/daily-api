import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  MockContext,
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  saveFixtures,
} from './helpers';
import { User } from '../src/entity';
import { Niche, NicheBucketGroup } from '../src/entity/Niche';
import { UserNicheAnalytics } from '../src/entity/user/UserNicheAnalytics';
import { UserNicheGrowth } from '../src/entity/user/UserNicheGrowth';
import { usersFixture } from './fixture/user';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

const nicheJs = '11111111-1111-4111-8111-111111111111';
const nicheAi = '22222222-2222-4222-8222-222222222222';
// The one niche hidden at serving time. Deliberately given the largest district
// below, so a test that forgets to exclude it fails on ordering too.
const nicheChain = '33333333-3333-4333-8333-333333333333';

beforeEach(async () => {
  loggedUser = null;
  await con.getRepository(UserNicheAnalytics).clear();
  await con.getRepository(UserNicheGrowth).clear();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Niche, [
    {
      id: nicheJs,
      slug: 'js_ts',
      title: 'JavaScript / TypeScript',
      bucketGroup: NicheBucketGroup.Ecosystem,
    },
    {
      id: nicheAi,
      slug: 'ai_llm',
      title: 'LLMs',
      bucketGroup: NicheBucketGroup.Theme,
    },
    {
      id: nicheChain,
      slug: 'blockchain',
      title: 'Blockchain',
      bucketGroup: NicheBucketGroup.Theme,
    },
  ]);

  await saveFixtures(con, UserNicheAnalytics, [
    {
      userId: '1',
      nicheId: nicheJs,
      reads: 50,
      firstReadAt: '2026-01-01',
      lastReadAt: '2026-06-01',
      activeDays: 20,
    },
    {
      userId: '1',
      nicheId: nicheAi,
      reads: 80,
      firstReadAt: '2026-02-01',
      lastReadAt: '2026-07-01',
      activeDays: 30,
    },
    {
      userId: '1',
      nicheId: nicheChain,
      reads: 100,
      firstReadAt: '2026-03-01',
      lastReadAt: '2026-07-02',
      activeDays: 40,
    },
    // a second world, to prove one user's districts never leak into another's
    {
      userId: '2',
      nicheId: nicheJs,
      reads: 7,
      firstReadAt: '2026-05-01',
      lastReadAt: '2026-05-02',
      activeDays: 2,
    },
  ]);

  await saveFixtures(con, UserNicheGrowth, [
    { userId: '1', date: '2026-02-01', nicheId: nicheAi, reads: 5 },
    { userId: '1', date: '2026-01-01', nicheId: nicheJs, reads: 3 },
    { userId: '1', date: '2026-03-01', nicheId: nicheChain, reads: 9 },
    { userId: '2', date: '2026-05-01', nicheId: nicheJs, reads: 7 },
  ]);
});

describe('query userWorld', () => {
  const QUERY = `query UserWorld($id: ID!) {
    userWorld(id: $id) {
      reads
      firstReadAt
      lastReadAt
      activeDays
      niche {
        id
        slug
        title
        bucketGroup
      }
    }
  }`;

  it('should return districts largest first with the niche resolved', async () => {
    const res = await client.query(QUERY, { variables: { id: '1' } });

    expect(res.errors).toBeFalsy();
    // blockchain is hidden at serving time even though it is the largest
    expect(res.data.userWorld).toEqual([
      {
        reads: 80,
        firstReadAt: new Date('2026-02-01').toISOString(),
        lastReadAt: new Date('2026-07-01').toISOString(),
        activeDays: 30,
        niche: {
          id: nicheAi,
          slug: 'ai_llm',
          title: 'LLMs',
          bucketGroup: 'theme',
        },
      },
      {
        reads: 50,
        firstReadAt: new Date('2026-01-01').toISOString(),
        lastReadAt: new Date('2026-06-01').toISOString(),
        activeDays: 20,
        niche: {
          id: nicheJs,
          slug: 'js_ts',
          title: 'JavaScript / TypeScript',
          bucketGroup: 'ecosystem',
        },
      },
    ]);
  });

  it('should be public', async () => {
    // worlds are shareable by design, so an anonymous viewer gets the same answer
    loggedUser = null;
    const anonymous = await client.query(QUERY, { variables: { id: '1' } });

    loggedUser = '2';
    const signedIn = await client.query(QUERY, { variables: { id: '1' } });

    expect(anonymous.errors).toBeFalsy();
    expect(signedIn.errors).toBeFalsy();
    expect(anonymous.data).toEqual(signedIn.data);
  });

  it('should not leak another user world', async () => {
    const res = await client.query(QUERY, { variables: { id: '2' } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorld).toHaveLength(1);
    expect(res.data.userWorld[0].reads).toBe(7);
    expect(res.data.userWorld[0].niche.slug).toBe('js_ts');
  });

  it('should return an empty world rather than an error', async () => {
    // a brand new account has no districts yet; that is a valid empty world, and
    // the non-null list type means a null here would surface as a GraphQL error
    const res = await client.query(QUERY, { variables: { id: '3' } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorld).toEqual([]);
  });

  it('should resolve without requesting the niche relation', async () => {
    // `nicheId` is a requiredColumn purely so graphorm can join the relation. If
    // that were wrong, dropping the relation from the selection would break the
    // query rather than simply return fewer fields.
    const res = await client.query(
      `query UserWorld($id: ID!) { userWorld(id: $id) { reads } }`,
      { variables: { id: '1' } },
    );

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorld).toEqual([{ reads: 80 }, { reads: 50 }]);
  });
});

describe('query userWorldTimeline', () => {
  const QUERY = `query UserWorldTimeline($id: ID!) {
    userWorldTimeline(id: $id) {
      date
      reads
      niche {
        slug
      }
    }
  }`;

  it('should return growth oldest first, hiding served-hidden niches', async () => {
    const res = await client.query(QUERY, { variables: { id: '1' } });

    expect(res.errors).toBeFalsy();
    // oldest first: the consumer replays this forward to build the world
    expect(res.data.userWorldTimeline).toEqual([
      {
        date: new Date('2026-01-01').toISOString(),
        reads: 3,
        niche: { slug: 'js_ts' },
      },
      {
        date: new Date('2026-02-01').toISOString(),
        reads: 5,
        niche: { slug: 'ai_llm' },
      },
    ]);
  });

  it('should be public', async () => {
    loggedUser = null;
    const anonymous = await client.query(QUERY, { variables: { id: '1' } });

    loggedUser = '2';
    const signedIn = await client.query(QUERY, { variables: { id: '1' } });

    expect(anonymous.errors).toBeFalsy();
    expect(anonymous.data).toEqual(signedIn.data);
  });

  it('should return an empty timeline rather than an error', async () => {
    const res = await client.query(QUERY, { variables: { id: '3' } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorldTimeline).toEqual([]);
  });

  it('should agree with the districts it accumulates into', async () => {
    // The timeline is the ledger the districts are folded from, so the two must
    // never disagree about how much a niche was read.
    const timeline = await client.query(QUERY, { variables: { id: '2' } });
    const world = await client.query(
      `query UserWorld($id: ID!) { userWorld(id: $id) { reads niche { slug } } }`,
      { variables: { id: '2' } },
    );

    expect(timeline.errors).toBeFalsy();
    expect(world.errors).toBeFalsy();

    const summed = timeline.data.userWorldTimeline.reduce(
      (total: number, row: { reads: number }) => total + row.reads,
      0,
    );
    expect(summed).toBe(world.data.userWorld[0].reads);
  });
});
