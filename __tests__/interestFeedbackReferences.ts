import { DataSource } from 'typeorm';
import nock from 'nock';
import type { FastifyBaseLogger } from 'fastify';
import createOrGetConnection from '../src/db';
import { saveFixtures } from './helpers';
import { ArticlePost, Source, User } from '../src/entity';
import { SharePost } from '../src/entity/posts/SharePost';
import { PostType } from '../src/entity/posts/Post';
import { UserInterest, UserInterestStatus } from '../src/entity/UserInterest';
import { InterestFeedback } from '../src/entity/InterestFeedback';
import { sweepInterestFeedbackReferences } from '../src/common/interest/feedbackReferences';
import { usersFixture } from './fixture/user';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture';

let con: DataSource;
const log = { warn: jest.fn() } as unknown as FastifyBaseLogger;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con.getRepository(UserInterest).save({
    id: 'uir-ref',
    userId: '1',
    query: 'cool zig projects',
    status: UserInterestStatus.Active,
  });
});

const sweep = async () => {
  const interest = await con
    .getRepository(UserInterest)
    .findOneByOrFail({ id: 'uir-ref' });
  await sweepInterestFeedbackReferences({ con, log, interest });
};

const saveFeedback = (id: string, text: string) =>
  con.getRepository(InterestFeedback).save({ id, interestId: 'uir-ref', text });

const getFeedback = (id: string) =>
  con.getRepository(InterestFeedback).findOneByOrFail({ id });

describe('sweepInterestFeedbackReferences', () => {
  it('should resolve marker tokens, dedupe by post, and snapshot the post', async () => {
    await saveFeedback(
      'fb-1',
      'love @dailydev:post:p1 and again @dailydev:post:p1',
    );

    await sweep();

    const row = await getFeedback('fb-1');
    expect(row.relationships).toEqual([
      {
        id: expect.any(String),
        entity: 'post',
        entityId: 'p1',
        url: null,
        title: 'P1',
        summary: null,
      },
    ]);
    const relId = row.relationships?.[0].id;
    expect(row.text).toEqual(
      `love @dailydev:post:p1:${relId} and again @dailydev:post:p1:${relId}`,
    );
  });

  it('should resolve daily.dev post and /r/ urls into markers', async () => {
    await saveFeedback(
      'fb-2',
      'see http://localhost:5002/posts/p1 and http://localhost:4000/r/p2',
    );

    await sweep();

    const row = await getFeedback('fb-2');
    expect(row.relationships).toEqual([
      {
        id: expect.any(String),
        entity: 'post',
        entityId: 'p1',
        url: 'http://localhost:5002/posts/p1',
        title: 'P1',
        summary: null,
      },
      {
        id: expect.any(String),
        entity: 'post',
        entityId: 'p2',
        url: 'http://localhost:4000/r/p2',
        title: 'P2',
        summary: null,
      },
    ]);
    const [first, second] = row.relationships ?? [];
    expect(row.text).toEqual(
      `see @dailydev:post:p1:${first.id} and @dailydev:post:p2:${second.id}`,
    );
  });

  it('should follow dly.to redirects before resolving', async () => {
    nock('https://dly.to').get('/abc123').reply(302, undefined, {
      location: 'http://localhost:5002/posts/p2',
    });
    await saveFeedback('fb-3', 'this one https://dly.to/abc123');

    await sweep();

    const row = await getFeedback('fb-3');
    expect(row.relationships).toEqual([
      {
        id: expect.any(String),
        entity: 'post',
        entityId: 'p2',
        url: 'https://dly.to/abc123',
        title: 'P2',
        summary: null,
      },
    ]);
    expect(row.text).toEqual(
      `this one @dailydev:post:p2:${row.relationships?.[0].id}`,
    );
  });

  it('should mark failed tokens with the null sentinel and store no entry', async () => {
    await saveFeedback('fb-4', 'what about @dailydev:post:doesnotexist');

    await sweep();

    const row = await getFeedback('fb-4');
    expect(row.text).toEqual('what about @dailydev:post:doesnotexist:null');
    expect(row.relationships).toEqual([]);
  });

  it('should leave unresolved urls untouched while marking the row processed', async () => {
    await saveFeedback('fb-5', 'read https://unknown.example.com/article');

    await sweep();

    const row = await getFeedback('fb-5');
    expect(row.text).toEqual('read https://unknown.example.com/article');
    expect(row.relationships).toEqual([]);
  });

  it('should not resolve posts the interest cannot see', async () => {
    await con.getRepository(ArticlePost).save([
      {
        id: 'priv1',
        shortId: 'priv1',
        title: 'Private post',
        url: 'http://priv1.com',
        sourceId: 'a',
        private: true,
        visible: true,
        type: PostType.Article,
      },
      {
        id: 'invis1',
        shortId: 'invis1',
        title: 'Invisible post',
        url: 'http://invis1.com',
        sourceId: 'a',
        private: false,
        visible: false,
        type: PostType.Article,
      },
    ]);
    await saveFeedback(
      'fb-6',
      'hidden @dailydev:post:priv1 and @dailydev:post:invis1',
    );

    await sweep();

    const row = await getFeedback('fb-6');
    expect(row.text).toEqual(
      'hidden @dailydev:post:priv1:null and @dailydev:post:invis1:null',
    );
    expect(row.relationships).toEqual([]);
  });

  it('should fall back to the shared post for title and summary', async () => {
    await con.getRepository(SharePost).save({
      id: 'share1',
      shortId: 'share1',
      sourceId: 'a',
      sharedPostId: 'p1',
      type: PostType.Share,
      visible: true,
    });
    await saveFeedback('fb-7', 'shared @dailydev:post:share1');

    await sweep();

    const row = await getFeedback('fb-7');
    expect(row.relationships).toEqual([
      {
        id: expect.any(String),
        entity: 'post',
        entityId: 'share1',
        url: null,
        title: 'P1',
        summary: null,
      },
    ]);
  });

  it('should skip rows that were already processed', async () => {
    await con.getRepository(InterestFeedback).save({
      id: 'fb-8',
      interestId: 'uir-ref',
      text: 'processed @dailydev:post:p1',
      relationships: [],
    });

    await sweep();

    const row = await getFeedback('fb-8');
    expect(row.text).toEqual('processed @dailydev:post:p1');
    expect(row.relationships).toEqual([]);
  });

  it('should cap url resolution at five urls per row', async () => {
    const url = 'http://localhost:5002/posts/p1';
    await saveFeedback('fb-9', Array(6).fill(url).join(' '));

    await sweep();

    const row = await getFeedback('fb-9');
    const relId = row.relationships?.[0].id;
    const marker = `@dailydev:post:p1:${relId}`;
    expect(row.text).toEqual(`${Array(5).fill(marker).join(' ')} ${url}`);
  });
});
