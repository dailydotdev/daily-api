import { DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { ArticlePost, Source, User } from '../../../src/entity';
import { AgentSource } from '../../../src/entity/Source';
import { SharePost } from '../../../src/entity/posts/SharePost';
import {
  UserInterest,
  UserInterestStatus,
} from '../../../src/entity/UserInterest';
import {
  InterestFinding,
  InterestFindingOrigin,
  InterestFindingStatus,
} from '../../../src/entity/InterestFinding';
import { usersFixture } from '../../fixture/user';
import { postsFixture } from '../../fixture/post';
import { sourcesFixture } from '../../fixture';
import { remoteConfig } from '../../../src/remoteConfig';
import { discoverExternalUrls } from '../../../src/common/interest/discoverExternalUrls';
import { discoverAndIngestExternal } from '../../../src/common/interest/runInterestAgent';

jest.mock('../../../src/common/interest/discoverExternalUrls', () => ({
  discoverExternalUrls: jest.fn(),
}));

let con: DataSource;

const logger = {
  child: () => ({ info: jest.fn(), warn: jest.fn() }),
} as unknown as FastifyBaseLogger;

const interest = {
  id: 'uir-d',
  query: 'cool zig projects',
  userId: '1',
  sourceId: 'asrc-d',
  fomoThreshold: 0.5,
  sources: { dailyDev: true, web: true, github: false },
};

const setCandidates = (candidates: unknown[]) =>
  (discoverExternalUrls as jest.Mock).mockResolvedValue(candidates);

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con.getRepository(AgentSource).save({
    id: 'asrc-d',
    name: 'agent source',
    handle: 'agent-asrc-d',
    private: true,
  });
  await con.getRepository(UserInterest).save({
    id: 'uir-d',
    userId: '1',
    query: 'cool zig projects',
    status: UserInterestStatus.Active,
    sourceId: 'asrc-d',
    fomoThreshold: 0.5,
  });
});

afterEach(() => {
  remoteConfig.vars.interestAgentMaxDiscoveriesPerDay = undefined;
});

describe('discoverAndIngestExternal', () => {
  it('creates an article, a share in the agent source, and a discovery finding pointing at the share', async () => {
    setCandidates([
      { url: 'https://ext.com/a', title: 'A', rationale: 'why', score: 0.9 },
    ]);

    const result = await discoverAndIngestExternal({
      con,
      logger,
      interest,
      query: 'zig',
    });

    expect(result.added).toBe(1);

    const findings = await con
      .getRepository(InterestFinding)
      .findBy({ interestId: 'uir-d' });
    expect(findings).toHaveLength(1);
    expect(findings[0].origin).toBe(InterestFindingOrigin.Discovery);

    const share = await con
      .getRepository(SharePost)
      .findOneByOrFail({ id: findings[0].postId });
    expect(share.sourceId).toBe('asrc-d');
    expect(share.private).toBe(true);
    expect(share.visible).toBe(true);

    const article = await con
      .getRepository(ArticlePost)
      .findOneByOrFail({ id: share.sharedPostId as string });
    expect(article.url).toBe('https://ext.com/a');
  });

  it('does not inflate the count when the same url is rediscovered (dedup, no duplicate share/finding)', async () => {
    setCandidates([
      { url: 'https://ext.com/a', title: 'A', rationale: 'why', score: 0.9 },
    ]);

    const first = await discoverAndIngestExternal({
      con,
      logger,
      interest,
      query: 'zig',
    });
    const second = await discoverAndIngestExternal({
      con,
      logger,
      interest,
      query: 'zig',
    });

    expect(first.added).toBe(1);
    expect(second.added).toBe(0);
    expect(
      await con.getRepository(InterestFinding).countBy({ interestId: 'uir-d' }),
    ).toBe(1);
    expect(
      await con.getRepository(SharePost).countBy({ sourceId: 'asrc-d' }),
    ).toBe(1);
  });

  it('does nothing and does not search when the web source is off', async () => {
    setCandidates([
      { url: 'https://ext.com/x', title: 'X', rationale: 'why', score: 0.9 },
    ]);

    const result = await discoverAndIngestExternal({
      con,
      logger,
      interest: {
        ...interest,
        sources: { dailyDev: true, web: false, github: false },
      },
      query: 'zig',
    });

    expect(result.added).toBe(0);
    expect(discoverExternalUrls).not.toHaveBeenCalled();
    expect(
      await con.getRepository(InterestFinding).countBy({ interestId: 'uir-d' }),
    ).toBe(0);
  });

  it('skips candidates below the fomo threshold', async () => {
    setCandidates([
      { url: 'https://ext.com/b', title: 'B', rationale: 'why', score: 0.2 },
    ]);

    const result = await discoverAndIngestExternal({
      con,
      logger,
      interest,
      query: 'zig',
    });

    expect(result.added).toBe(0);
    expect(
      await con.getRepository(InterestFinding).countBy({ interestId: 'uir-d' }),
    ).toBe(0);
  });

  it('short-circuits when the daily discovery cap is reached and does not search', async () => {
    remoteConfig.vars.interestAgentMaxDiscoveriesPerDay = 1;

    await con.getRepository(InterestFinding).save({
      id: 'finding-cap',
      interestId: 'uir-d',
      postId: postsFixture[0].id,
      score: 0.9,
      status: InterestFindingStatus.New,
      origin: InterestFindingOrigin.Discovery,
    });
    setCandidates([
      { url: 'https://ext.com/c', title: 'C', rationale: 'why', score: 0.9 },
    ]);

    const result = await discoverAndIngestExternal({
      con,
      logger,
      interest,
      query: 'zig',
    });

    expect(result.added).toBe(0);
    expect(discoverExternalUrls).not.toHaveBeenCalled();
  });
});
