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
    extractTags: jest.fn(),
    recommendTags: jest.fn(),
  },
}));

const discoverPostsMock = recswipeClient.discoverPosts as jest.MockedFunction<
  typeof recswipeClient.discoverPosts
>;
const extractTagsMock = recswipeClient.extractTags as jest.MockedFunction<
  typeof recswipeClient.extractTags
>;
const recommendTagsMock = recswipeClient.recommendTags as jest.MockedFunction<
  typeof recswipeClient.recommendTags
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

describe('mutation onboardingExtractTags', () => {
  const MUTATION = /* GraphQL */ `
    mutation OnboardingExtractTags($prompt: String!) {
      onboardingExtractTags(prompt: $prompt) {
        tags
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
      { mutation: MUTATION, variables: { prompt: '' } },
      'ZOD_VALIDATION_ERROR',
    );
    expect(extractTagsMock).not.toHaveBeenCalled();
  });

  it('should forward prompt to recswipe client and return tags', async () => {
    loggedUser = '1';
    extractTagsMock.mockResolvedValueOnce({
      tags: ['rust', 'systems'],
    });

    const res = await client.mutate(MUTATION, {
      variables: { prompt: 'I like rust and systems programming' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      onboardingExtractTags: { tags: ['rust', 'systems'] },
    });
    expect(extractTagsMock).toHaveBeenCalledWith('1', {
      prompt: 'I like rust and systems programming',
    });
  });

  it('should default missing tags array to empty list', async () => {
    loggedUser = '1';
    extractTagsMock.mockResolvedValueOnce({
      tags: undefined as unknown as string[],
    });

    const res = await client.mutate(MUTATION, {
      variables: { prompt: 'go' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({ onboardingExtractTags: { tags: [] } });
  });

  it('should surface an UNEXPECTED error when recswipe responds with HttpError', async () => {
    loggedUser = '1';
    extractTagsMock.mockRejectedValueOnce(
      new HttpError('http://recswipe.local:8000/api/extract-tags', 500, 'boom'),
    );

    const res = await client.mutate(MUTATION, {
      variables: { prompt: 'rust' },
    });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].extensions?.code).toBe('UNEXPECTED');
  });
});

describe('mutation onboardingRecommendTags', () => {
  const MUTATION = /* GraphQL */ `
    mutation OnboardingRecommendTags($selectedTags: [String!]!, $n: Int) {
      onboardingRecommendTags(selectedTags: $selectedTags, n: $n) {
        tags
      }
    }
  `;

  it('should require authentication', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { selectedTags: ['rust'] } },
      'UNAUTHENTICATED',
    ));

  it('should reject empty selectedTags via Zod', async () => {
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { selectedTags: [] } },
      'ZOD_VALIDATION_ERROR',
    );
    expect(recommendTagsMock).not.toHaveBeenCalled();
  });

  it('should forward args and flatten recommended_tags to tag names', async () => {
    loggedUser = '1';
    recommendTagsMock.mockResolvedValueOnce({
      recommended_tags: [
        { tag: 'rust', score: 0.9 },
        { tag: 'systems', score: 0.7 },
      ],
    });

    const res = await client.mutate(MUTATION, {
      variables: { selectedTags: ['rust'], n: 5 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      onboardingRecommendTags: { tags: ['rust', 'systems'] },
    });
    expect(recommendTagsMock).toHaveBeenCalledWith('1', {
      selectedTags: ['rust'],
      n: 5,
    });
  });

  it('should default missing recommended_tags array to empty list', async () => {
    loggedUser = '1';
    recommendTagsMock.mockResolvedValueOnce({
      recommended_tags: undefined as unknown as {
        tag: string;
        score: number;
      }[],
    });

    const res = await client.mutate(MUTATION, {
      variables: { selectedTags: ['rust'] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({ onboardingRecommendTags: { tags: [] } });
  });

  it('should surface an UNEXPECTED error when recswipe responds with HttpError', async () => {
    loggedUser = '1';
    recommendTagsMock.mockRejectedValueOnce(
      new HttpError(
        'http://recswipe.local:8000/api/recommend-tags',
        500,
        'boom',
      ),
    );

    const res = await client.mutate(MUTATION, {
      variables: { selectedTags: ['rust'] },
    });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].extensions?.code).toBe('UNEXPECTED');
  });
});
