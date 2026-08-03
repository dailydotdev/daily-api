import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { ArticlePost, Source, User } from '../../../src/entity';
import { Comment } from '../../../src/entity/Comment';
import { Feed } from '../../../src/entity/Feed';
import { FeedTag } from '../../../src/entity/FeedTag';
import { Keyword, KeywordStatus } from '../../../src/entity/Keyword';
import { PostKeyword } from '../../../src/entity/PostKeyword';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../../../src/entity/InterestFinding';
import {
  UserInterest,
  UserInterestStatus,
} from '../../../src/entity/UserInterest';
import { createInterestAgentTools } from '../../../src/common/interest/runInterestAgent';
import { COLLECTIONS_SOURCE } from '../../../src/common/interest/exclusions';
import { usersFixture } from '../../fixture/user';
import { postsFixture } from '../../fixture/post';
import { sourcesFixture } from '../../fixture';
import { PostType } from '../../../src/entity/posts/Post';

let con: DataSource;

type ToolHandler = (
  id: never,
  params: Record<string, unknown>,
) => Promise<{ content: { text: string }[] }>;

const logger = {
  child: () => logger,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as never;

// pi is mocked out under Jest, so capture what registerTools would have
// registered and call the real execute functions directly.
const getTools = async () => {
  const interest = await con
    .getRepository(UserInterest)
    .findOneByOrFail({ id: 'uir-1' });
  const built = await createInterestAgentTools({ con, logger, interest });
  const captured: Record<string, ToolHandler> = {};
  built.registerTools({
    registerTool: ({
      name,
      execute,
    }: {
      name: string;
      execute: ToolHandler;
    }) => {
      captured[name] = execute;
    },
  } as never);
  return { ...built, captured };
};

const call = async (
  captured: Record<string, ToolHandler>,
  name: string,
  params: Record<string, unknown> = {},
) => {
  const res = await captured[name](undefined as never, params);
  return JSON.parse(res.content[0].text);
};

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, Keyword, [
    { value: 'zig', status: KeywordStatus.Allow, occurrences: 10 },
    { value: 'ziglang', status: KeywordStatus.Synonym, synonym: 'zig' },
  ]);
  await con.getRepository(PostKeyword).save([
    { postId: 'p1', keyword: 'zig', status: KeywordStatus.Allow },
    { postId: 'p2', keyword: 'zig', status: KeywordStatus.Allow },
  ]);
  await con.getRepository(Feed).save({ id: 'feed-1', userId: '1', flags: {} });
  await con.getRepository(Source).save({
    id: 'agent-src-1',
    name: 'Agent',
    handle: 'agent-src-1',
    private: true,
    type: 'agent',
  });
  await con.getRepository(UserInterest).save({
    id: 'uir-1',
    userId: '1',
    query: 'cool zig projects',
    status: UserInterestStatus.Active,
    feedId: 'feed-1',
    sourceId: 'agent-src-1',
    fomoThreshold: 0.5,
  });
});

describe('read_comments', () => {
  beforeEach(async () => {
    await con.getRepository(Comment).save([
      {
        id: 'c1',
        postId: 'p1',
        userId: '1',
        content: 'top level',
        contentHtml: '<p>top level</p>',
        upvotes: 5,
      },
      {
        id: 'c2',
        postId: 'p1',
        userId: '2',
        parentId: 'c1',
        content: 'a reply',
        contentHtml: '<p>a reply</p>',
        upvotes: 1,
      },
    ]);
  });

  it('returns the discussion with honest counts', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'read_comments', { postId: 'p1' });

    expect(res.comments).toHaveLength(1);
    expect(res.comments[0]).toMatchObject({
      author: usersFixture[0].username,
      content: 'top level',
    });
    expect(res.comments[0].replies).toHaveLength(1);
    expect(res.shown).toEqual({ parents: 1, replies: 1 });
  });

  it('refuses a banned post', async () => {
    await con.getRepository(ArticlePost).update({ id: 'p1' }, { banned: true });
    const { captured } = await getTools();

    expect(
      await call(captured, 'read_comments', { postId: 'p1' }),
    ).toMatchObject({ comments: [] });
  });

  it('refuses a private post from another source', async () => {
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { private: true });
    const { captured } = await getTools();

    expect(
      await call(captured, 'read_comments', { postId: 'p1' }),
    ).toMatchObject({ comments: [] });
  });
});

describe('read_post', () => {
  it('refuses a banned post but still reports quality signals for a live one', async () => {
    const { captured } = await getTools();

    const live = await call(captured, 'read_post', { postId: 'p1' });
    expect(live).toMatchObject({ postId: 'p1', alreadyDelivered: false });
    expect(live.engagement).toHaveProperty('downvotes');

    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { deleted: true });
    const { captured: after } = await getTools();
    expect(await call(after, 'read_post', { postId: 'p1' })).toMatchObject({
      error: 'not_found',
    });
  });
});

describe('get_tag', () => {
  it('resolves a synonym to its canonical tag', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'get_tag', { tag: 'ziglang' });

    expect(res).toMatchObject({ tag: 'zig', resolvedFrom: 'ziglang' });
  });

  it('reports an unknown tag rather than an empty result', async () => {
    const { captured } = await getTools();

    expect(await call(captured, 'get_tag', { tag: 'nope' })).toMatchObject({
      error: 'tag_not_found',
    });
  });
});

describe('query_feed', () => {
  it('resolves a synonym for the tag scope instead of returning nothing', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', {
      scope: 'tag',
      tag: 'ziglang',
    });

    expect(res.resolvedTag).toEqual('zig');
    expect(res.candidates.map((c: { postId: string }) => c.postId)).toEqual(
      expect.arrayContaining(['p1', 'p2']),
    );
  });

  it('rejects an unknown tag distinguishably from an empty page', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'query_feed', { scope: 'tag', tag: 'nope' }),
    ).toMatchObject({ error: 'tag_not_found' });
  });

  it('reports a clamped offset', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', {
      scope: 'tag',
      tag: 'zig',
      offset: 5000,
    });

    expect(res).toMatchObject({ offset: 200, offsetClamped: true });
  });

  it('excludes aggregation posts from candidates', async () => {
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { type: PostType.Collection });
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', {
      scope: 'tag',
      tag: 'zig',
    });

    expect(
      res.candidates.map((c: { postId: string }) => c.postId),
    ).not.toContain('p1');
  });
});

describe('get_source', () => {
  it('refuses an excluded source addressed by handle, not just by id', async () => {
    await con.getRepository(Source).save({
      id: COLLECTIONS_SOURCE,
      name: 'Collections',
      handle: 'collections-handle',
      private: false,
    });
    const { captured } = await getTools();

    expect(
      await call(captured, 'get_source', { source: 'collections-handle' }),
    ).toMatchObject({ error: 'source_excluded' });
  });
});

describe('add_finding', () => {
  it('records a finding once and refuses the same post again', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'add_finding', {
        postId: 'p1',
        score: 0.9,
        rationale: 'on topic',
      }),
    ).toMatchObject({ added: true });

    expect(
      await call(captured, 'add_finding', {
        postId: 'p1',
        score: 0.9,
        rationale: 'again',
      }),
    ).toMatchObject({ added: false, error: 'already_delivered' });

    const findings = await con
      .getRepository(InterestFinding)
      .findBy({ interestId: 'uir-1' });
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toEqual(InterestFindingStatus.New);
  });

  it('refuses a banned post', async () => {
    await con.getRepository(ArticlePost).update({ id: 'p1' }, { banned: true });
    const { captured } = await getTools();

    expect(
      await call(captured, 'add_finding', {
        postId: 'p1',
        score: 0.9,
        rationale: 'on topic',
      }),
    ).toMatchObject({ added: false, error: 'not_public' });
  });

  it('refuses a score below the FOMO threshold', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'add_finding', {
        postId: 'p1',
        score: 0.1,
        rationale: 'weak',
      }),
    ).toMatchObject({ added: false, error: 'below_fomo_threshold' });
  });
});

describe('write_post', () => {
  it('refuses when the run has nothing new, and refuses a second call', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'write_post', { title: 'T', content: 'C' }),
    ).toMatchObject({ error: 'nothing_new_to_report' });

    await call(captured, 'add_finding', {
      postId: 'p1',
      score: 0.9,
      rationale: 'on topic',
    });

    const first = await call(captured, 'write_post', {
      title: 'T',
      content: 'C',
    });
    expect(first.postId).toBeTruthy();

    expect(
      await call(captured, 'write_post', { title: 'T2', content: 'C2' }),
    ).toMatchObject({ error: 'already_written', postId: first.postId });
  });
});

describe('set_interest_tags', () => {
  it('keeps only real tags and reports the dropped ones', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'set_interest_tags', {
      tags: ['zig', 'not-a-real-tag'],
    });

    expect(res).toMatchObject({
      savedTags: ['zig'],
      dropped: ['not-a-real-tag'],
    });
    const saved = await con.getRepository(FeedTag).findBy({ feedId: 'feed-1' });
    expect(saved.map((row) => row.tag)).toEqual(['zig']);
  });
});
