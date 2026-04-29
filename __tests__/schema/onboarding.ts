import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
} from '../helpers';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture/user';
import { recswipeClient } from '../../src/integrations/recswipe/clients';
import { HttpError } from '../../src/integrations/retry';

jest.mock('../../src/integrations/recswipe/clients', () => ({
  recswipeClient: {
    discoverPosts: jest.fn(),
  },
}));

const discoverPostsMock = recswipeClient.discoverPosts as jest.MockedFunction<
  typeof recswipeClient.discoverPosts
>;

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

beforeEach(async () => {
  loggedUser = null;
  jest.clearAllMocks();
  await saveFixtures(con, User, usersFixture);
});

describe('mutation onboardingDiscoverPosts', () => {
  const MUTATION = /* GraphQL */ `
    mutation OnboardingDiscoverPosts(
      $prompt: String
      $selectedTags: [String!]
      $confirmedTags: [String!]
      $likedTitles: [String!]
      $excludeIds: [String!]
      $saturatedTags: [String!]
      $n: Int
    ) {
      onboardingDiscoverPosts(
        prompt: $prompt
        selectedTags: $selectedTags
        confirmedTags: $confirmedTags
        likedTitles: $likedTitles
        excludeIds: $excludeIds
        saturatedTags: $saturatedTags
        n: $n
      ) {
        posts {
          postId
          title
          summary
          tags
          url
          sourceId
        }
        subPrompts
      }
    }
  `;

  it('should require authentication', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { prompt: 'rust' } },
      'UNAUTHENTICATED',
    ));

  it('should reject input that fails Zod validation', async () => {
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { n: 999 } },
      'ZOD_VALIDATION_ERROR',
    );
    expect(discoverPostsMock).not.toHaveBeenCalled();
  });

  it('should map snake_case response to camelCase output', async () => {
    loggedUser = '1';
    discoverPostsMock.mockResolvedValueOnce({
      posts: [
        {
          post_id: 'p1',
          title: 'Hello',
          summary: 'Summary',
          tags: ['rust', 'systems'],
          url: 'https://example.com/p1',
          source_id: 'src-1',
        },
        {
          post_id: 'p2',
          title: 'World',
          summary: 'Other',
          tags: ['go'],
          url: 'https://example.com/p2',
          source_id: 'src-2',
        },
      ],
      sub_prompts: ['rust developer', 'systems programming'],
    });

    const res = await client.mutate(MUTATION, {
      variables: { prompt: 'rust', n: 4 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      onboardingDiscoverPosts: {
        posts: [
          {
            postId: 'p1',
            title: 'Hello',
            summary: 'Summary',
            tags: ['rust', 'systems'],
            url: 'https://example.com/p1',
            sourceId: 'src-1',
          },
          {
            postId: 'p2',
            title: 'World',
            summary: 'Other',
            tags: ['go'],
            url: 'https://example.com/p2',
            sourceId: 'src-2',
          },
        ],
        subPrompts: ['rust developer', 'systems programming'],
      },
    });
  });

  it('should forward all params with defaults to recswipe client', async () => {
    loggedUser = '1';
    discoverPostsMock.mockResolvedValueOnce({
      posts: [],
      sub_prompts: [],
    });

    await client.mutate(MUTATION, {
      variables: {
        prompt: 'go',
        selectedTags: ['go'],
        confirmedTags: ['backend'],
        likedTitles: ['Title A'],
        excludeIds: ['p1'],
        saturatedTags: ['javascript'],
        n: 4,
      },
    });

    expect(discoverPostsMock).toHaveBeenCalledWith('1', {
      prompt: 'go',
      selectedTags: ['go'],
      confirmedTags: ['backend'],
      likedTitles: ['Title A'],
      excludeIds: ['p1'],
      saturatedTags: ['javascript'],
      n: 4,
    });
  });

  it('should default empty params when fields omitted', async () => {
    loggedUser = '1';
    discoverPostsMock.mockResolvedValueOnce({
      posts: [],
      sub_prompts: [],
    });

    await client.mutate(MUTATION, { variables: {} });

    expect(discoverPostsMock).toHaveBeenCalledWith('1', {
      prompt: '',
      selectedTags: [],
      confirmedTags: [],
      likedTitles: [],
      excludeIds: [],
      saturatedTags: [],
      n: 8,
    });
  });

  it('should surface an UNEXPECTED error when recswipe responds with HttpError', async () => {
    loggedUser = '1';
    discoverPostsMock.mockRejectedValueOnce(
      new HttpError(
        'http://recswipe.local:8000/api/discover-posts',
        500,
        'boom',
      ),
    );

    const res = await client.mutate(MUTATION, {
      variables: { prompt: 'rust' },
    });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].extensions?.code).toBe('UNEXPECTED');
  });
});
