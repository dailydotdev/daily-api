import appFunc from '../../../src';
import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { authorizeRequest, saveFixtures } from '../../helpers';
import { Keyword, KeywordStatus, User } from '../../../src/entity';
import { FeedTag } from '../../../src/entity/FeedTag';
import { ContentPreferenceKeyword } from '../../../src/entity/contentPreference/ContentPreferenceKeyword';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../../src/entity/contentPreference/types';
import { usersFixture } from '../../fixture/user';
import * as bragiClients from '../../../src/integrations/bragi/clients';
import type { ServiceClient } from '../../../src/types';
import { Pipelines } from '@dailydotdev/schema';

jest.mock('../../../src/integrations/bragi/clients', () => ({
  getBragiClient: jest.fn(),
}));

const mockGetBragiClient = jest.mocked(bragiClients.getBragiClient);

let app: FastifyInstance;
let con: DataSource;

const createBragiClientMock = ({
  result,
  error,
}: {
  result?: { extractedTags: { name: string; confidence: number }[] };
  error?: Error;
}) => {
  const gitHubProfileTags = jest.fn(async () => {
    if (error) {
      throw error;
    }

    return {
      id: 'test',
      extractedTags: result?.extractedTags ?? [],
    };
  });

  const client = {
    instance: {
      gitHubProfileTags,
    },
    garmr: {
      execute: async <T>(fn: () => Promise<T>) => fn(),
    },
  } as unknown as ServiceClient<typeof Pipelines>;

  return {
    client,
    gitHubProfileTags,
  };
};

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
});

describe('POST /integrations/github/profile-tags', () => {
  it('should return 401 when user is not authenticated', async () => {
    await request(app.server)
      .post('/integrations/github/profile-tags')
      .send({ githubPersonalToken: 'ghp_test_token' })
      .expect(401);
  });

  it('should return 400 for invalid body', async () => {
    const response = await authorizeRequest(
      request(app.server)
        .post('/integrations/github/profile-tags')
        .send({ githubPersonalToken: '' }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toHaveProperty('name', 'ZodError');
  });

  it('should return extracted onboarding tags from bragi', async () => {
    const keywords = ['gh-onboard-python', 'gh-onboard-react', 'gh-onboard-go'];

    await saveFixtures(
      con,
      Keyword,
      keywords.map((value) => ({
        value,
        status: KeywordStatus.Allow,
        flags: { onboarding: true },
      })),
    );

    const bragiMock = createBragiClientMock({
      result: {
        extractedTags: [
          { name: 'gh-onboard-python', confidence: 0.92 },
          { name: 'GH-ONBOARD-PYTHON', confidence: 0.74 },
          { name: 'gh-onboard-react', confidence: 0.81 },
          { name: 'not-in-vocabulary', confidence: 0.99 },
        ],
      },
    });
    mockGetBragiClient.mockReturnValue(bragiMock.client);

    const response = await authorizeRequest(
      request(app.server)
        .post('/integrations/github/profile-tags')
        .send({ githubPersonalToken: 'ghp_test_token' }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      tags: ['gh-onboard-python', 'gh-onboard-react'],
      extractedTags: [
        { name: 'gh-onboard-python', confidence: 0.92 },
        { name: 'gh-onboard-react', confidence: 0.81 },
      ],
    });
    expect(bragiMock.gitHubProfileTags).toHaveBeenCalledTimes(1);
    expect(bragiMock.gitHubProfileTags).toHaveBeenCalledWith(
      expect.objectContaining({
        githubPersonalToken: 'ghp_test_token',
        tagVocabulary: expect.arrayContaining(keywords),
      }),
    );

    const contentPreferences = await con
      .getRepository(ContentPreferenceKeyword)
      .findBy({
        userId: '1',
        feedId: '1',
        type: ContentPreferenceType.Keyword,
      });
    expect(contentPreferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: '1',
          feedId: '1',
          referenceId: 'gh-onboard-python',
          keywordId: 'gh-onboard-python',
          status: ContentPreferenceStatus.Follow,
        }),
        expect.objectContaining({
          userId: '1',
          feedId: '1',
          referenceId: 'gh-onboard-react',
          keywordId: 'gh-onboard-react',
          status: ContentPreferenceStatus.Follow,
        }),
      ]),
    );

    const feedTags = await con.getRepository(FeedTag).findBy({ feedId: '1' });
    expect(feedTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feedId: '1', tag: 'gh-onboard-python' }),
        expect.objectContaining({ feedId: '1', tag: 'gh-onboard-react' }),
      ]),
    );
  });

  it('should filter tags by minConfidence', async () => {
    const keywords = ['gh-onboard-low', 'gh-onboard-high'];

    await saveFixtures(
      con,
      Keyword,
      keywords.map((value) => ({
        value,
        status: KeywordStatus.Allow,
        flags: { onboarding: true },
      })),
    );

    const bragiMock = createBragiClientMock({
      result: {
        extractedTags: [
          { name: 'gh-onboard-low', confidence: 0.55 },
          { name: 'gh-onboard-high', confidence: 0.9 },
        ],
      },
    });
    mockGetBragiClient.mockReturnValue(bragiMock.client);

    const response = await authorizeRequest(
      request(app.server).post('/integrations/github/profile-tags').send({
        githubPersonalToken: 'ghp_test_token',
        minConfidence: 0.8,
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      tags: ['gh-onboard-high'],
      extractedTags: [{ name: 'gh-onboard-high', confidence: 0.9 }],
    });

    const followedTags = await con
      .getRepository(FeedTag)
      .findBy({ feedId: '1' });
    expect(followedTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feedId: '1', tag: 'gh-onboard-high' }),
      ]),
    );
    expect(
      followedTags.find((item) => item.tag === 'gh-onboard-low'),
    ).toBeUndefined();
  });

  it('should return 502 when bragi call fails', async () => {
    await saveFixtures(con, Keyword, [
      {
        value: 'gh-onboard-failure-case',
        status: KeywordStatus.Allow,
        flags: { onboarding: true },
      },
    ]);

    const bragiMock = createBragiClientMock({
      error: new Error('Bragi unavailable'),
    });
    mockGetBragiClient.mockReturnValue(bragiMock.client);

    const response = await authorizeRequest(
      request(app.server)
        .post('/integrations/github/profile-tags')
        .send({ githubPersonalToken: 'ghp_test_token' }),
    );

    expect(response.statusCode).toBe(502);
    expect(response.body).toEqual({
      error: 'Failed to extract GitHub profile tags',
    });
  });
});
