import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  MockContext,
  createMockLogger,
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { UserWorldSettings } from '../src/entity/user/UserWorldSettings';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
  User,
} from '../src/entity';
import { UserAchievement } from '../src/entity/user/UserAchievement';
import { syncUserRetroactiveAchievements } from '../src/common/achievement/retroactive';
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
  await con.getRepository(UserWorldSettings).clear();
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

describe('query userWorldSettings', () => {
  const QUERY = `query UserWorldSettings($id: ID!) {
    userWorldSettings(id: $id) {
      name
      private
      sky { pal hour }
      crest { charge div a b }
      look { id base mine name ol bl }
    }
  }`;

  it('should be null for a world nobody has customised', async () => {
    // null means "no config", and it can only mean that — being refused is an
    // error rather than a second thing this null has to stand for
    const res = await client.query(QUERY, { variables: { id: '1' } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorldSettings).toBeNull();
  });

  it('should serve back only what was actually chosen', async () => {
    await con.getRepository(UserWorldSettings).save({
      userId: '1',
      sky: { pal: 'slate', hour: 'night' },
    });

    const res = await client.query(QUERY, { variables: { id: '1' } });

    expect(res.errors).toBeFalsy();
    // the untouched customisations stay null for the client to default
    expect(res.data.userWorldSettings).toEqual({
      name: null,
      private: false,
      sky: { pal: 'slate', hour: 'night' },
      crest: null,
      look: null,
    });
  });

  it('should serve a stored crest back', async () => {
    await con.getRepository(UserWorldSettings).save({
      userId: '1',
      crest: { charge: 'loom', div: 'bend', a: 0xffe877, b: 0x887bf8 },
    });

    const res = await client.query(QUERY, { variables: { id: '1' } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorldSettings.crest).toEqual({
      charge: 'loom',
      div: 'bend',
      a: 0xffe877,
      b: 0x887bf8,
    });
  });
});

describe('query userWorldEntitlements', () => {
  const QUERY = `query UserWorldEntitlements($id: ID!) {
    userWorldEntitlements(id: $id) { kind id source }
  }`;

  it('should grant a charge per monument and a tincture per founded district', async () => {
    const res = await client.query(QUERY, { variables: { id: '1' } });

    expect(res.errors).toBeFalsy();
    // blockchain is hidden at serving, so it grants nothing at all
    expect(res.data.userWorldEntitlements).toEqual([
      { kind: 'charge', id: 'obelisk', source: 'niche:ai_llm' },
      { kind: 'tincture', id: '#d97efe', source: 'niche:ai_llm' },
      { kind: 'tincture', id: '#887bf8', source: 'niche:ai_llm' },
      { kind: 'charge', id: 'loom', source: 'niche:js_ts' },
      { kind: 'tincture', id: '#ffe877', source: 'niche:js_ts' },
      { kind: 'tincture', id: '#ffb794', source: 'niche:js_ts' },
    ]);
  });

  it('should grant no charge from a district below level 3', async () => {
    // A monument appears at L3. Under it the accents are still founded, but
    // there is nothing raised to put on a shield.
    await con.getRepository(UserNicheAnalytics).save({
      userId: '3',
      nicheId: nicheJs,
      reads: 2,
      firstReadAt: '2026-04-01',
      lastReadAt: '2026-04-02',
      activeDays: 1,
    });

    const res = await client.query(QUERY, { variables: { id: '3' } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorldEntitlements).toEqual([
      { kind: 'tincture', id: '#ffe877', source: 'niche:js_ts' },
      { kind: 'tincture', id: '#ffb794', source: 'niche:js_ts' },
    ]);
  });

  it('should give a reader of nothing no entitlements at all', async () => {
    // and therefore no crest — eligibility is having raised something, and
    // there is no starter mark to hand out
    const res = await client.query(QUERY, { variables: { id: '4' } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userWorldEntitlements).toEqual([]);
  });
});

describe('mutation updateUserWorldSettings', () => {
  const MUTATION = `mutation UpdateUserWorldSettings(
    $name: String, $sky: UserWorldSkyInput, $crest: UserWorldCrestInput, $private: Boolean
  ) {
    updateUserWorldSettings(name: $name, sky: $sky, crest: $crest, private: $private) {
      name
      private
      sky { pal hour }
      crest { charge div a b }
    }
  }`;

  it('should require authentication', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { name: 'the quiet archive' } },
      'UNAUTHENTICATED',
    ));

  it('should store a name and a sky without touching the rest', async () => {
    loggedUser = '1';
    const named = await client.mutate(MUTATION, {
      variables: { name: 'the quiet archive' },
    });
    const skied = await client.mutate(MUTATION, {
      variables: { sky: { pal: 'slate', hour: 'night' } },
    });

    expect(named.errors).toBeFalsy();
    expect(skied.errors).toBeFalsy();
    // the second call never mentioned the name, so it must survive
    expect(skied.data.updateUserWorldSettings).toMatchObject({
      name: 'the quiet archive',
      sky: { pal: 'slate', hour: 'night' },
    });
  });

  it('should unname a world when sent null', async () => {
    loggedUser = '1';
    await client.mutate(MUTATION, { variables: { name: 'the quiet archive' } });
    const res = await client.mutate(MUTATION, { variables: { name: null } });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserWorldSettings.name).toBeNull();
  });

  it('should accept a crest built out of earned monuments and accents', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        crest: { charge: 'loom', div: 'chevron', a: 0xffb794, b: 0x887bf8 },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateUserWorldSettings.crest).toEqual({
      charge: 'loom',
      div: 'chevron',
      a: 0xffb794,
      b: 0x887bf8,
    });
  });

  it('should reject a charge the reading has not earned', async () => {
    // anvilyard belongs to linux_os, which this user has never read
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          crest: {
            charge: 'anvilyard',
            div: 'plain',
            a: 0xd97efe,
            b: 0xffe877,
          },
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'charge "anvilyard" is not available to this world',
    );
  });

  it('should reject a tincture that is no founded district accent', async () => {
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          crest: { charge: 'obelisk', div: 'plain', a: 0xd97efe, b: 0x000000 },
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'tincture "b" is not available to this world',
    );
  });

  it('should not let a reader of nothing fly any crest', async () => {
    // user 4 has read nothing, so no charge exists that they could claim —
    // eligibility falls out of the entitlements rather than being a separate rule
    loggedUser = '4';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          crest: { charge: 'obelisk', div: 'plain', a: 0xd97efe, b: 0xffe877 },
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'this world has not raised anything to put on a crest',
    );
  });

  describe('world setup achievement', () => {
    const achievementId = '44444444-4444-4444-8444-444444444444';

    beforeEach(async () => {
      await con.createQueryBuilder().delete().from(UserAchievement).execute();
      await con.getRepository(Achievement).save({
        id: achievementId,
        name: 'Terraformer test',
        description: 'Make your world your own',
        image: '',
        type: AchievementType.Instant,
        eventType: AchievementEventType.WorldSetup,
        criteria: { targetCount: 1 },
        points: 5,
      });
    });

    it('should unlock on the first piece of dressing', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, {
        variables: { name: 'the quiet archive' },
      });

      expect(res.errors).toBeFalsy();
      expect(
        await con
          .getRepository(UserAchievement)
          .findOneBy({ achievementId, userId: '1' }),
      ).toMatchObject({ progress: 1, unlockedAt: expect.any(Date) });
    });

    it('should not unlock when only the privacy toggle changed', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, {
        variables: { private: true },
      });

      expect(res.errors).toBeFalsy();
      expect(
        await con
          .getRepository(UserAchievement)
          .findOneBy({ achievementId, userId: '1' }),
      ).toBeNull();
    });

    it('should not unlock when the dressing is cleared', async () => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION, {
        variables: { name: null },
      });

      expect(res.errors).toBeFalsy();
      expect(
        await con
          .getRepository(UserAchievement)
          .findOneBy({ achievementId, userId: '1' }),
      ).toBeNull();
    });

    it('should unlock retroactively for a world dressed before the achievement existed', async () => {
      await con
        .getRepository(UserWorldSettings)
        .save({ userId: '2', name: 'the long shelf' });

      await syncUserRetroactiveAchievements({
        con,
        logger: createMockLogger(),
        userId: '2',
      });

      expect(
        await con
          .getRepository(UserAchievement)
          .findOneBy({ achievementId, userId: '2' }),
      ).toMatchObject({ progress: 1, unlockedAt: expect.any(Date) });
    });
  });
});

describe('world privacy', () => {
  const WORLD = `query UserWorld($id: ID!) { userWorld(id: $id) { reads } }`;
  const TIMELINE = `query UserWorldTimeline($id: ID!) { userWorldTimeline(id: $id) { reads } }`;
  const SETTINGS = `query UserWorldSettings($id: ID!) { userWorldSettings(id: $id) { private } }`;
  const ENTITLEMENTS = `query UserWorldEntitlements($id: ID!) { userWorldEntitlements(id: $id) { id } }`;

  beforeEach(async () => {
    await con
      .getRepository(UserWorldSettings)
      .upsert({ userId: '1', private: true }, ['userId']);
  });

  it('should refuse the settings and the catalogue outright', async () => {
    // an error rather than a null, so being refused never looks like a world
    // whose owner has simply not customised anything
    loggedUser = '2';
    await testQueryErrorCode(
      client,
      { query: SETTINGS, variables: { id: '1' } },
      'FORBIDDEN',
      'This world is private',
    );
    await testQueryErrorCode(
      client,
      { query: ENTITLEMENTS, variables: { id: '1' } },
      'FORBIDDEN',
      'This world is private',
    );
  });

  it('should empty the world and the timeline for everyone else', async () => {
    loggedUser = '2';
    const world = await client.query(WORLD, { variables: { id: '1' } });
    const timeline = await client.query(TIMELINE, { variables: { id: '1' } });

    expect(world.data.userWorld).toEqual([]);
    expect(timeline.data.userWorldTimeline).toEqual([]);
  });

  it('should hide it from anonymous viewers', async () => {
    loggedUser = null;
    const world = await client.query(WORLD, { variables: { id: '1' } });

    expect(world.data.userWorld).toEqual([]);
    await testQueryErrorCode(
      client,
      { query: SETTINGS, variables: { id: '1' } },
      'FORBIDDEN',
    );
  });

  it('should still show the owner their own world', async () => {
    loggedUser = '1';
    const world = await client.query(WORLD, { variables: { id: '1' } });
    const timeline = await client.query(TIMELINE, { variables: { id: '1' } });
    const settings = await client.query(SETTINGS, { variables: { id: '1' } });

    expect(world.data.userWorld).toEqual([{ reads: 80 }, { reads: 50 }]);
    expect(timeline.data.userWorldTimeline).toHaveLength(2);
    expect(settings.data.userWorldSettings).toEqual({ private: true });
  });

  it('should not hide a world whose owner never set the flag', async () => {
    loggedUser = '1';
    const res = await client.query(WORLD, { variables: { id: '2' } });

    expect(res.data.userWorld).toEqual([{ reads: 7 }]);
  });
});
