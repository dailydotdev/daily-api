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
import { Keyword, KeywordStatus } from '../../src/entity/Keyword';

jest.mock('../../src/integrations/recswipe/clients', () => ({
  recswipeClient: {
    discoverPosts: jest.fn(),
    extractTags: jest.fn(),
    recommendTags: jest.fn(),
  },
}));

const mockGuessWhoQuiz = jest.fn();
const mockNextPersonaQuizQuestion = jest.fn();
const mockPersonaQuizReveal = jest.fn();

jest.mock('../../src/integrations/bragi', () => ({
  getBragiClient: () => ({
    garmr: {
      execute: (fn: () => Promise<unknown>) => fn(),
    },
    instance: {
      guessWhoQuiz: (...args: unknown[]) => mockGuessWhoQuiz(...args),
      nextPersonaQuizQuestion: (...args: unknown[]) =>
        mockNextPersonaQuizQuestion(...args),
      personaQuizReveal: (...args: unknown[]) => mockPersonaQuizReveal(...args),
    },
  }),
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

describe('mutation guessWhoQuizStep', () => {
  const MUTATION = /* GraphQL */ `
    mutation GuessWhoQuizStep($history: [GuessWhoQuizQAInput!]!) {
      guessWhoQuizStep(history: $history) {
        nextQuestion {
          question
          options
        }
        finalPersona {
          name
          description
          tags
        }
      }
    }
  `;

  const fiveTurns = Array.from({ length: 5 }, (_, i) => ({
    question: `Q${i + 1}`,
    answer: `A${i + 1}`,
  }));

  it('should require authentication', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { history: fiveTurns } },
      'UNAUTHENTICATED',
    ));

  it('should reject input with fewer than 5 history pairs', async () => {
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { history: fiveTurns.slice(0, 3) } },
      'ZOD_VALIDATION_ERROR',
    );
    expect(mockGuessWhoQuiz).not.toHaveBeenCalled();
  });

  it('should return next question without calling recswipe', async () => {
    loggedUser = '1';
    mockGuessWhoQuiz.mockResolvedValueOnce({
      id: 'op-1',
      result: {
        case: 'nextQuestion',
        value: {
          question: 'How do you feel about feature flags?',
          options: ['ship it', 'sparingly', 'avoid', 'never used'],
        },
      },
    });

    const res = await client.mutate(MUTATION, {
      variables: { history: fiveTurns },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      guessWhoQuizStep: {
        nextQuestion: {
          question: 'How do you feel about feature flags?',
          options: ['ship it', 'sparingly', 'avoid', 'never used'],
        },
        finalPersona: null,
      },
    });
    expect(extractTagsMock).not.toHaveBeenCalled();
  });

  it('should call recswipe.extractTags and return persona with tags on final', async () => {
    loggedUser = '1';
    mockGuessWhoQuiz.mockResolvedValueOnce({
      id: 'op-2',
      result: {
        case: 'finalPersona',
        value: {
          name: 'Pragmatic Backend Architect',
          description:
            'You wrangle systems for a living and stay quietly suspicious of every shiny new abstraction.',
        },
      },
    });
    extractTagsMock.mockResolvedValueOnce({
      tags: ['backend', 'systems', 'go'],
    });

    const res = await client.mutate(MUTATION, {
      variables: { history: fiveTurns },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      guessWhoQuizStep: {
        nextQuestion: null,
        finalPersona: {
          name: 'Pragmatic Backend Architect',
          description:
            'You wrangle systems for a living and stay quietly suspicious of every shiny new abstraction.',
          tags: ['backend', 'systems', 'go'],
        },
      },
    });
    expect(extractTagsMock).toHaveBeenCalledWith('1', {
      prompt:
        'You wrangle systems for a living and stay quietly suspicious of every shiny new abstraction.',
    });
  });

  it('should default missing tags to empty list', async () => {
    loggedUser = '1';
    mockGuessWhoQuiz.mockResolvedValueOnce({
      id: 'op-3',
      result: {
        case: 'finalPersona',
        value: {
          name: 'Curious Developer',
          description: 'You poke at things.',
        },
      },
    });
    extractTagsMock.mockResolvedValueOnce({
      tags: undefined as unknown as string[],
    });

    const res = await client.mutate(MUTATION, {
      variables: { history: fiveTurns },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      guessWhoQuizStep: {
        nextQuestion: null,
        finalPersona: {
          name: 'Curious Developer',
          description: 'You poke at things.',
          tags: [],
        },
      },
    });
  });

  it('should error when bragi returns neither branch', async () => {
    loggedUser = '1';
    mockGuessWhoQuiz.mockResolvedValueOnce({
      id: 'op-4',
      result: { case: undefined },
    });

    const res = await client.mutate(MUTATION, {
      variables: { history: fiveTurns },
    });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(extractTagsMock).not.toHaveBeenCalled();
  });

  it('should surface an UNEXPECTED error when recswipe extractTags fails', async () => {
    loggedUser = '1';
    mockGuessWhoQuiz.mockResolvedValueOnce({
      id: 'op-5',
      result: {
        case: 'finalPersona',
        value: { name: 'X', description: 'Y' },
      },
    });
    extractTagsMock.mockRejectedValueOnce(
      new HttpError('http://recswipe.local:8000/api/extract-tags', 500, 'boom'),
    );

    const res = await client.mutate(MUTATION, {
      variables: { history: fiveTurns },
    });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].extensions?.code).toBe('UNEXPECTED');
  });
});

describe('mutation personaQuizNextQuestion', () => {
  const MUTATION = /* GraphQL */ `
    mutation PersonaQuizNextQuestion(
      $priorAnswers: [PersonaQuizQAInput!]!
      $seedTags: [String!]!
      $askedCount: Int!
      $maxQuestions: Int
    ) {
      personaQuizNextQuestion(
        priorAnswers: $priorAnswers
        seedTags: $seedTags
        askedCount: $askedCount
        maxQuestions: $maxQuestions
      ) {
        isFinal
        question {
          id
          prompt
          axis
          cols
          options {
            id
            label
            emoji
            tagHints
          }
        }
      }
    }
  `;

  const oneAnswer = [
    {
      questionId: 'q_domain',
      question: 'Where do you spend most of your dev hours?',
      optionId: 'data-ml',
      answer: 'Data, ML, or AI engineering — broad lane',
    },
  ];

  it('should require authentication', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          priorAnswers: oneAnswer,
          seedTags: ['machine-learning'],
          askedCount: 1,
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should reject askedCount < 1', async () => {
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          priorAnswers: oneAnswer,
          seedTags: ['machine-learning'],
          askedCount: 0,
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
    expect(mockNextPersonaQuizQuestion).not.toHaveBeenCalled();
  });

  it('should pass recswipe candidate_topics to bragi and return structured question', async () => {
    loggedUser = '1';
    recommendTagsMock.mockResolvedValueOnce({
      tags: ['machine-learning', 'recommendation-systems', 'vector-search'],
    });
    mockNextPersonaQuizQuestion.mockResolvedValueOnce({
      id: 'op-1',
      isFinal: false,
      question: {
        id: 'q_llm_1',
        prompt: 'Vector databases anchor your retrieval pipeline.',
        axis: 'tooling',
        cols: 3,
        options: [
          { id: 'yes', label: 'Spot on', emoji: '', tagHints: ['vector-search'] },
          { id: 'sort_of', label: 'Sort of', emoji: '', tagHints: ['machine-learning'] },
          { id: 'no', label: 'Nope', emoji: '', tagHints: [] },
        ],
        rationale: 'ML user, retrieval is adjacent.',
      },
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        priorAnswers: oneAnswer,
        seedTags: ['machine-learning'],
        askedCount: 1,
        maxQuestions: 14,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      personaQuizNextQuestion: {
        isFinal: false,
        question: {
          id: 'q_llm_1',
          prompt: 'Vector databases anchor your retrieval pipeline.',
          axis: 'tooling',
          cols: 3,
          options: [
            { id: 'yes', label: 'Spot on', emoji: null, tagHints: ['vector-search'] },
            { id: 'sort_of', label: 'Sort of', emoji: null, tagHints: ['machine-learning'] },
            { id: 'no', label: 'Nope', emoji: null, tagHints: [] },
          ],
        },
      },
    });

    // Seed tag must be excluded from candidate_topics; pass-through to bragi.
    expect(recommendTagsMock).toHaveBeenCalledWith('1', {
      selectedTags: ['machine-learning'],
      n: 12,
    });
    expect(mockNextPersonaQuizQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateTopics: ['recommendation-systems', 'vector-search'],
        askedCount: 1,
        seedTags: ['machine-learning'],
      }),
    );
  });

  it('should propagate isFinal=true with null question', async () => {
    loggedUser = '1';
    recommendTagsMock.mockResolvedValueOnce({ tags: [] });
    mockNextPersonaQuizQuestion.mockResolvedValueOnce({
      id: 'op-2',
      isFinal: true,
      question: undefined,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        priorAnswers: oneAnswer,
        seedTags: ['machine-learning'],
        askedCount: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      personaQuizNextQuestion: { isFinal: true, question: null },
    });
  });

  it('should still call bragi when recswipe candidate-topics fetch fails', async () => {
    loggedUser = '1';
    recommendTagsMock.mockRejectedValueOnce(
      new HttpError('http://recswipe.local:8000/api/recommend-tags', 500, 'boom'),
    );
    mockNextPersonaQuizQuestion.mockResolvedValueOnce({
      id: 'op-3',
      isFinal: true,
      question: undefined,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        priorAnswers: oneAnswer,
        seedTags: ['machine-learning'],
        askedCount: 1,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(mockNextPersonaQuizQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ candidateTopics: [] }),
    );
  });
});

describe('mutation personaQuizReveal', () => {
  const MUTATION = /* GraphQL */ `
    mutation PersonaQuizReveal(
      $answers: [PersonaQuizQAInput!]!
      $seedTags: [String!]!
      $targetCount: Int
    ) {
      personaQuizReveal(
        answers: $answers
        seedTags: $seedTags
        targetCount: $targetCount
      ) {
        includeTags
        reveal {
          headline
          description
        }
      }
    }
  `;

  const oneAnswer = [
    {
      questionId: 'q_domain',
      question: 'Where do you spend most of your dev hours?',
      optionId: 'frontend',
      answer: 'Frontend / UI craft',
    },
  ];

  beforeEach(async () => {
    await saveFixtures(con, Keyword, [
      { value: 'react', occurrences: 100, status: KeywordStatus.Allow },
      { value: 'typescript', occurrences: 100, status: KeywordStatus.Allow },
      { value: 'tailwindcss', occurrences: 50, status: KeywordStatus.Allow },
      { value: 'css', occurrences: 80, status: KeywordStatus.Allow },
    ]);
  });

  it('should require authentication', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          answers: oneAnswer,
          seedTags: ['react'],
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should filter bragi tags through the Keyword table and return reveal copy', async () => {
    loggedUser = '1';
    mockPersonaQuizReveal.mockResolvedValueOnce({
      id: 'op-r-1',
      includeTags: [
        'react',
        'typescript',
        'hallucinated-slug', // not in Keyword table — must be dropped
        'tailwindcss',
      ],
      reveal: {
        headline: 'Friday-shipper, refactor addict',
        description: 'Feed tuned for someone who reads dev drama and ships anyway.',
      },
    });
    recommendTagsMock.mockResolvedValueOnce({ tags: ['css'] });

    const res = await client.mutate(MUTATION, {
      variables: {
        answers: oneAnswer,
        seedTags: ['react'],
        targetCount: 6,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data?.personaQuizReveal.reveal).toEqual({
      headline: 'Friday-shipper, refactor addict',
      description: 'Feed tuned for someone who reads dev drama and ships anyway.',
    });
    // Order: bragi tags first (canonical-only), then recsys fillers.
    expect(res.data?.personaQuizReveal.includeTags).toEqual([
      'react',
      'typescript',
      'tailwindcss',
      'css',
    ]);
    expect(res.data?.personaQuizReveal.includeTags).not.toContain(
      'hallucinated-slug',
    );
  });

  it('should cap returned tags at targetCount', async () => {
    loggedUser = '1';
    mockPersonaQuizReveal.mockResolvedValueOnce({
      id: 'op-r-2',
      includeTags: ['react', 'typescript', 'tailwindcss', 'css'],
      reveal: { headline: 'h', description: 'd' },
    });
    recommendTagsMock.mockResolvedValueOnce({ tags: [] });

    const res = await client.mutate(MUTATION, {
      variables: {
        answers: oneAnswer,
        seedTags: ['react'],
        targetCount: 2,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data?.personaQuizReveal.includeTags).toHaveLength(2);
    expect(res.data?.personaQuizReveal.includeTags).toEqual([
      'react',
      'typescript',
    ]);
  });

  it('should return empty tag list when nothing matches the Keyword table', async () => {
    loggedUser = '1';
    mockPersonaQuizReveal.mockResolvedValueOnce({
      id: 'op-r-3',
      includeTags: ['nonsense-1', 'nonsense-2'],
      reveal: { headline: 'h', description: 'd' },
    });
    recommendTagsMock.mockResolvedValueOnce({ tags: ['another-nonsense'] });

    const res = await client.mutate(MUTATION, {
      variables: {
        answers: oneAnswer,
        seedTags: ['react'],
        targetCount: 8,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data?.personaQuizReveal.includeTags).toEqual([]);
  });

  it('should still call bragi when recswipe fillers fetch fails', async () => {
    loggedUser = '1';
    mockPersonaQuizReveal.mockResolvedValueOnce({
      id: 'op-r-4',
      includeTags: ['react'],
      reveal: { headline: 'h', description: 'd' },
    });
    recommendTagsMock.mockRejectedValueOnce(
      new HttpError('http://recswipe.local:8000/api/recommend-tags', 500, 'boom'),
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        answers: oneAnswer,
        seedTags: ['react'],
        targetCount: 6,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data?.personaQuizReveal.includeTags).toEqual(['react']);
  });
});
