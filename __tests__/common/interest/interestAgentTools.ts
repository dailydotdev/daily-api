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
import { remoteConfig } from '../../../src/remoteConfig';

// The interest/tags scopes call the feed service; the source/tag scopes are
// plain SQL and run against the real database.
jest.mock('../../../src/integrations/feed/generators', () => ({
  ...(jest.requireActual('../../../src/integrations/feed/generators') as Record<
    string,
    unknown
  >),
  getForYouByTagFeedGenerator: () => ({
    generate: async () => ({ data: [{ id: 'p1' }, { id: 'p2' }] }),
  }),
}));

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
  remoteConfig.vars.interestAgentMaxTags = undefined;
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

  it('reports a banned post as not found rather than comment-less', async () => {
    await con.getRepository(ArticlePost).update({ id: 'p1' }, { banned: true });
    const { captured } = await getTools();

    expect(
      await call(captured, 'read_comments', { postId: 'p1' }),
    ).toMatchObject({ error: 'not_found' });
  });

  it('reports a private post as not found rather than comment-less', async () => {
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { private: true });
    const { captured } = await getTools();

    expect(
      await call(captured, 'read_comments', { postId: 'p1' }),
    ).toMatchObject({ error: 'not_found' });
  });

  it('reports the real post comment count, not the number returned', async () => {
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { comments: 200 });
    const { captured } = await getTools();
    const res = await call(captured, 'read_comments', { postId: 'p1' });

    expect(res.postCommentCount).toEqual(200);
    expect(res.shown).toEqual({ parents: 1, replies: 1 });
  });
});

describe('read_post', () => {
  it('reports engagement and quality signals for a visible post', async () => {
    await con
      .getRepository(ArticlePost)
      .update(
        { id: 'p1' },
        { downvotes: 3, contentQuality: { is_clickbait_probability: 0.8 } },
      );
    const { captured } = await getTools();

    const res = await call(captured, 'read_post', { postId: 'p1' });
    expect(res).toMatchObject({
      postId: 'p1',
      alreadyDelivered: false,
      contentQuality: { is_clickbait_probability: 0.8 },
    });
    expect(res.engagement.downvotes).toEqual(3);
  });

  it.each([['banned'], ['deleted']])('refuses a %s post', async (field) => {
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { [field]: true });
    const { captured } = await getTools();

    expect(await call(captured, 'read_post', { postId: 'p1' })).toMatchObject({
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

  it('pages by rows examined, so no candidate is skipped', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', {
      scope: 'tag',
      tag: 'zig',
      limit: 10,
      offset: 20,
    });

    expect(res).toMatchObject({
      offset: 20,
      nextOffset: 30,
      requested: 10,
      offsetClamped: false,
    });
  });

  it('reports the paging ceiling instead of a stride the tool would clamp', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', {
      scope: 'tag',
      tag: 'zig',
      limit: 10,
      offset: 5000,
    });

    expect(res).toMatchObject({
      offset: 200,
      offsetClamped: true,
      pagingLimitReached: true,
    });
    expect(res.nextOffset).toBeUndefined();
  });

  it('windows the tag scope by default and reports the window applied', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'query_feed', { scope: 'tag', tag: 'zig' }),
    ).toMatchObject({ orderBy: 'upvotes', periodDays: 30 });
  });

  it('lets an explicit period widen the tag scope window', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'query_feed', {
        scope: 'tag',
        tag: 'zig',
        period: 180,
      }),
    ).toMatchObject({ periodDays: 180 });
  });

  it('does not window the source scope, which one source already bounds', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', {
      scope: 'source',
      sourceId: 'a',
    });

    expect(res.periodDays).toBeUndefined();
  });

  it('normalises and synonym-resolves tags passed to the tags scope', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', {
      scope: 'tags',
      tags: ['ZIG', 'ziglang', 'nope'],
    });

    expect(res.tags).toEqual(['zig']);
    expect(res.unknownTags).toEqual(['nope']);
  });

  it('separates an unknown vocabulary from an empty topic on the tags scope', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'query_feed', { scope: 'tags', tags: ['nope'] }),
    ).toMatchObject({ error: 'tags_not_found', unknownTags: ['nope'] });
  });

  it('returns candidates for the interest scope from the saved tags', async () => {
    await con.getRepository(FeedTag).save({ feedId: 'feed-1', tag: 'zig' });
    const { captured } = await getTools();
    const res = await call(captured, 'query_feed', { scope: 'interest' });

    expect(res.candidates.map((c: { postId: string }) => c.postId)).toEqual(
      expect.arrayContaining(['p1', 'p2']),
    );
    expect(res.orderBy).toBeUndefined();
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
  it('normalises case, resolves synonyms, and reports only genuinely unknown slugs', async () => {
    const { captured } = await getTools();
    const res = await call(captured, 'set_interest_tags', {
      tags: ['ZIG', 'ziglang', 'not-a-real-tag'],
    });

    expect(res).toMatchObject({
      savedTags: ['zig'],
      unknown: ['not-a-real-tag'],
      overCap: [],
    });
    const saved = await con.getRepository(FeedTag).findBy({ feedId: 'feed-1' });
    expect(saved.map((row) => row.tag)).toEqual(['zig']);
  });

  it('separates real tags cut by the cap from unknown ones', async () => {
    await con.getRepository(Keyword).save(
      ['alpha', 'beta'].map((value) => ({
        value,
        status: KeywordStatus.Allow,
        occurrences: 1,
      })),
    );
    remoteConfig.vars.interestAgentMaxTags = 2;
    const { captured } = await getTools();
    const res = await call(captured, 'set_interest_tags', {
      tags: ['zig', 'alpha', 'beta', 'nope'],
    });

    expect(res).toMatchObject({
      savedTags: ['zig', 'alpha'],
      overCap: ['beta'],
      unknown: ['nope'],
      maxTags: 2,
    });
    const saved = await con.getRepository(FeedTag).findBy({ feedId: 'feed-1' });
    expect(saved.map((row) => row.tag).sort()).toEqual(['alpha', 'zig']);
  });

  it('skips the write when the resolved set already matches', async () => {
    const { captured } = await getTools();

    expect(
      await call(captured, 'set_interest_tags', { tags: ['zig'] }),
    ).toMatchObject({ savedTags: ['zig'], unchanged: false });
    expect(
      await call(captured, 'set_interest_tags', { tags: ['ZIG'] }),
    ).toMatchObject({ savedTags: ['zig'], unchanged: true });
  });

  it.each([[['zog', 'not-real']], [[]]])(
    'keeps the existing tags when nothing resolves from %j',
    async (tags) => {
      await con.getRepository(FeedTag).save([
        { feedId: 'feed-1', tag: 'zig' },
        { feedId: 'feed-1', tag: 'rust' },
      ]);
      const { captured } = await getTools();

      const res = await call(captured, 'set_interest_tags', { tags });
      expect(res.error).toEqual(
        tags.length ? 'no_tags_resolved' : 'tags_required',
      );
      expect(res.keptTags).toEqual(expect.arrayContaining(['zig', 'rust']));

      const saved = await con
        .getRepository(FeedTag)
        .findBy({ feedId: 'feed-1' });
      expect(saved.map((row) => row.tag).sort()).toEqual(['rust', 'zig']);
    },
  );

  it('is not gated by the exploration budget, as the prompt promises', async () => {
    const { captured, ...built } = await getTools();
    // Drain the budget, then confirm tags still persist.
    while (!built.consumeBudget()) {
      /* spend it */
    }

    expect(
      await call(captured, 'set_interest_tags', { tags: ['zig'] }),
    ).toMatchObject({ savedTags: ['zig'] });
  });
});
