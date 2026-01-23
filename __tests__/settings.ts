import { v4 as uuidv4 } from 'uuid';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryError,
  testQueryErrorCode,
} from './helpers';
import {
  CampaignCtaPlacement,
  ChecklistViewState,
  Settings,
  User,
} from '../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';
import { SortCommentsBy } from '../src/schema/comments';

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

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, User, usersFixture);
});

afterAll(() => disposeGraphQLTesting(state));

const compatibilityProps = { enableCardAnimations: true, appInsaneMode: true };

describe('query bookmarksSharing', () => {
  const QUERY = `{
  bookmarksSharing {
    enabled
    slug
    rssUrl
  }
}`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return disabled settings', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    const settings = repo.create({ userId: '1' });
    const data = await repo.save(settings);
    const expected = new Object({ ...data, ...compatibilityProps });
    delete expected['updatedAt'];

    const res = await client.query(QUERY);
    expect(res.data.bookmarksSharing.enabled).toEqual(false);
    expect(res.data.bookmarksSharing.slug).toBeFalsy();
    expect(res.data.bookmarksSharing.rssUrl).toBeFalsy();
  });

  it('should return enabled settings', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    const settings = repo.create({ userId: '1', bookmarkSlug: uuidv4() });
    const data = await repo.save(settings);
    const expected = new Object({ ...data, ...compatibilityProps });
    delete expected['updatedAt'];

    const res = await client.query(QUERY);
    expect(res.data.bookmarksSharing.enabled).toEqual(true);
    expect(res.data.bookmarksSharing.slug).toEqual(settings.bookmarkSlug);
    expect(res.data.bookmarksSharing.rssUrl).toEqual(
      `http://localhost:4000/rss/b/${settings.bookmarkSlug}`,
    );
  });
});

describe('mutation updateUserSettings', () => {
  const MUTATION = `
  mutation UpdateUserSettings($data: UpdateSettingsInput!) {
  updateUserSettings(data: $data) {
    userId
    theme
    enableCardAnimations
    showTopSites
    insaneMode
    appInsaneMode
    spaciness
    showOnlyUnreadPosts
    openNewTab
    sidebarExpanded
    companionExpanded
    sortingEnabled
    customLinks
    optOutWeeklyGoal
    optOutReadingStreak
    optOutCompanion
    campaignCtaPlacement
    onboardingChecklistView
    sortCommentsBy
    defaultWriteTab
    flags {
      sidebarCustomFeedsExpanded
      sidebarOtherExpanded
      sidebarResourcesExpanded
      sidebarSquadExpanded
      sidebarBookmarksExpanded
      clickbaitShieldEnabled
    }
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { theme: 'bright', insaneMode: true } },
      },
      'UNAUTHENTICATED',
    ));

  it('should create user settings when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { data: { theme: 'bright', insaneMode: true } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should create user settings flags when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { data: { flags: { sidebarCustomFeedsExpanded: false } } },
    });

    expect(res.data.updateUserSettings.flags).toEqual({
      sidebarCustomFeedsExpanded: false,
      sidebarOtherExpanded: null,
      sidebarResourcesExpanded: null,
      sidebarSquadExpanded: null,
      sidebarBookmarksExpanded: null,
      clickbaitShieldEnabled: null,
    });
  });

  it('should create user settings flags for prompts when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        data: { flags: { prompt: { 'simplify-it': false } } },
      },
    });

    expect(res.data.updateUserSettings.flags).toEqual({
      sidebarCustomFeedsExpanded: null,
      sidebarOtherExpanded: null,
      sidebarResourcesExpanded: null,
      sidebarSquadExpanded: null,
      sidebarBookmarksExpanded: null,
      clickbaitShieldEnabled: null,
    });

    const userSettings = await con.getRepository(Settings).findOneOrFail({
      where: { userId: '1' },
    });
    expect(userSettings.flags).toEqual({
      prompt: { 'simplify-it': false },
    });
  });

  it('should not allow non boolean prompts', async () => {
    loggedUser = '1';

    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          data: { flags: { prompt: { 'simplify-it': 'some value' } } },
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow invalid user links', async () => {
    loggedUser = '1';

    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { customLinks: ['http://'] } },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not allow invalid user links even when there are valid ones', async () => {
    loggedUser = '1';

    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          data: { customLinks: ['https://app.daily.dev', 'http://'] },
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should update user links if valid', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.save(
      repo.create({
        userId: '1',
      }),
    );

    const res = await client.mutate(MUTATION, {
      variables: { data: { customLinks: ['http://abc.com'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should update selected algo by user for comments section', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    const settings = await repo.save(repo.create({ userId: '1' }));
    expect(settings.sortCommentsBy).toEqual('oldest');

    const res = await client.mutate(MUTATION, {
      variables: { data: { sortCommentsBy: SortCommentsBy.NewestFirst } },
    });
    expect(res.data.updateUserSettings.sortCommentsBy).toEqual('newest');
    const updated = await repo.findOneBy({ userId: '1' });
    expect(updated.sortCommentsBy).toEqual('newest');
  });

  it('should update user settings', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.save(
      repo.create({
        userId: '1',
        theme: 'bright',
        insaneMode: true,
        customLinks: ['http://abc.com'],
      }),
    );

    const res = await client.mutate(MUTATION, {
      variables: { data: { insaneMode: false } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should update user settings flags', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.save(
      repo.create({
        userId: '1',
        flags: {
          sidebarCustomFeedsExpanded: false,
          sidebarOtherExpanded: true,
        },
      }),
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          flags: {
            sidebarCustomFeedsExpanded: true,
            sidebarOtherExpanded: false,
          },
        },
      },
    });

    expect(res.data.updateUserSettings.flags).toEqual({
      sidebarCustomFeedsExpanded: true,
      sidebarOtherExpanded: false,
      sidebarResourcesExpanded: null,
      sidebarSquadExpanded: null,
      sidebarBookmarksExpanded: null,
      clickbaitShieldEnabled: null,
    });
  });

  it('should update but not remove user settings flags', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.save(
      repo.create({
        userId: '1',
        flags: {
          sidebarCustomFeedsExpanded: false,
          sidebarOtherExpanded: true,
        },
      }),
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          flags: {
            sidebarCustomFeedsExpanded: true,
          },
        },
      },
    });

    expect(res.data.updateUserSettings.flags).toEqual({
      sidebarCustomFeedsExpanded: true,
      sidebarOtherExpanded: true,
      sidebarResourcesExpanded: null,
      sidebarSquadExpanded: null,
      sidebarBookmarksExpanded: null,
      clickbaitShieldEnabled: null,
    });
  });

  it('should update opt out companion settings', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.save(
      repo.create({
        userId: '1',
        optOutCompanion: false,
      }),
    );

    const res = await client.mutate(MUTATION, {
      variables: { data: { optOutCompanion: true } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should update campaignCtaPlacement', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.insert({
      userId: '1',
      optOutCompanion: false,
      campaignCtaPlacement: CampaignCtaPlacement.Header,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        data: { campaignCtaPlacement: CampaignCtaPlacement.ProfileMenu },
      },
    });

    expect(res.data.updateUserSettings.campaignCtaPlacement).toBe(
      CampaignCtaPlacement.ProfileMenu,
    );
  });

  it('should return a validation error if passed an invalid value for campaignCtaPlacement', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.insert({
      userId: '1',
      optOutCompanion: false,
      campaignCtaPlacement: CampaignCtaPlacement.Header,
    });

    await testQueryError(
      client,
      {
        query: MUTATION,
        variables: {
          data: { campaignCtaPlacement: 'foo' as CampaignCtaPlacement },
        },
      },
      (errors) => {
        expect(errors[0].extensions.code).toEqual('GRAPHQL_VALIDATION_FAILED');
        expect(errors[0].message).toEqual(
          `Invalid value for 'campaignCtaPlacement'`,
        );
      },
    );
  });

  it('should update onboardingChecklistView', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.insert({
      userId: '1',
      onboardingChecklistView: ChecklistViewState.Closed,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        data: { onboardingChecklistView: ChecklistViewState.Open },
      },
    });

    expect(res.data.updateUserSettings.onboardingChecklistView).toBe(
      ChecklistViewState.Open,
    );
  });

  it('should update defaultWriteTab', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.insert({
      userId: '1',
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        data: { defaultWriteTab: 'newpost' },
      },
    });

    expect(res.data.updateUserSettings.defaultWriteTab).toBe('newpost');
  });

  it('should return a validation error if passed an invalid value for defaultWriteTab', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.insert({
      userId: '1',
    });

    await testQueryError(
      client,
      {
        query: MUTATION,
        variables: {
          data: { defaultWriteTab: 'invalid' },
        },
      },
      (errors) => {
        expect(errors[0].extensions.code).toEqual('GRAPHQL_VALIDATION_FAILED');
        expect(errors[0].message).toEqual(
          `Invalid value for 'defaultWriteTab'`,
        );
      },
    );
  });
});

describe('mutation setBookmarksSharing', () => {
  const MUTATION = `
  mutation SetBookmarksSharing($enabled: Boolean!) {
  setBookmarksSharing(enabled: $enabled) {
    enabled
    slug
    rssUrl
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { enabled: true },
      },
      'UNAUTHENTICATED',
    ));

  it('should enable bookmarks sharing', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { enabled: true },
    });
    expect(res.data.setBookmarksSharing.enabled).toEqual(true);
    expect(res.data.setBookmarksSharing.slug).toBeTruthy();
    expect(res.data.setBookmarksSharing.rssUrl).toEqual(
      `http://localhost:4000/rss/b/${res.data.setBookmarksSharing.slug}`,
    );
  });

  it('should disable bookmarks sharing', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Settings);
    const settings = repo.create({ userId: '1', bookmarkSlug: uuidv4() });
    await repo.save(settings);
    const res = await client.mutate(MUTATION, {
      variables: { enabled: false },
    });
    expect(res.data.setBookmarksSharing.enabled).toEqual(false);
    expect(res.data.setBookmarksSharing.slug).toBeFalsy();
    expect(res.data.setBookmarksSharing.rssUrl).toBeFalsy();
  });

  it('should not do anything when bookmarks sharing is enabled', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Settings);
    const settings = repo.create({ userId: '1', bookmarkSlug: uuidv4() });
    const data = await repo.save(settings);
    const res = await client.mutate(MUTATION, {
      variables: { enabled: true },
    });
    expect(res.data.setBookmarksSharing.enabled).toEqual(true);
    expect(res.data.setBookmarksSharing.slug).toEqual(data.bookmarkSlug);
  });
});
