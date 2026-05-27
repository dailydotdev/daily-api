import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import {
  ArticlePost,
  Keyword,
  KeywordNiche,
  Niche,
  Post,
  PostNiche,
  Source,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import {
  keywordNichesFixture,
  nicheKeywordsFixture,
  nichesFixture,
  resolveKeywordNichesFixture,
} from '../fixture/niche';

let con: DataSource;
let nicheBySlug: Map<string, string>; // slug -> nicheId

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Niche, nichesFixture);
  const niches = await con.getRepository(Niche).find();
  nicheBySlug = new Map(niches.map((n) => [n.slug, n.id]));
  await saveFixtures(con, Keyword, nicheKeywordsFixture);
  await saveFixtures(
    con,
    KeywordNiche,
    await resolveKeywordNichesFixture(niches),
  );
});

const insertPost = async (id: string, tagsStr?: string | null) => {
  await con.getRepository(ArticlePost).insert({
    id,
    shortId: id,
    title: id,
    sourceId: 'a',
    tagsStr: tagsStr ?? undefined,
  });
};

const getNiches = async (
  postId: string,
): Promise<{ rank: number; slug: string }[]> => {
  const rows = await con
    .getRepository(PostNiche)
    .createQueryBuilder('pn')
    .innerJoin(Niche, 'n', 'n.id = pn."nicheId"')
    .where('pn."postId" = :id', { id: postId })
    .select(['pn.rank AS rank', 'n.slug AS slug'])
    .orderBy('pn.rank', 'ASC')
    .getRawMany<{ rank: number; slug: string }>();
  return rows.map((r) => ({ rank: Number(r.rank), slug: r.slug }));
};

describe('post_niche trigger', () => {
  it('falls back to "other" for an empty tagsStr', async () => {
    await insertPost('np1', null);
    expect(await getNiches('np1')).toEqual([{ rank: 1, slug: 'other' }]);
  });

  it('falls back to "other" when no tag matches a labeled keyword', async () => {
    await insertPost('np2', 'unlabeled-tag');
    expect(await getNiches('np2')).toEqual([{ rank: 1, slug: 'other' }]);
  });

  it('derives a primary niche from a single labeled tag (no secondary)', async () => {
    await insertPost('np3', 'rust');
    // single-labeled-tag posts get a primary only (min-2-tags-for-secondary)
    expect(await getNiches('np3')).toEqual([{ rank: 1, slug: 'rust' }]);
  });

  it('sums multiple labeled tags into the same niche', async () => {
    await insertPost('np4', 'javascript,typescript,react,nextjs');
    expect(await getNiches('np4')).toEqual([{ rank: 1, slug: 'js_ts' }]);
  });

  it('applies the ecosystem boost so an ecosystem niche wins over a theme niche on equal vote', async () => {
    // rust (ecosystem) + cli (theme=devtools) -> rust must win after 1.4x boost
    await insertPost('np5', 'rust,cli');
    const niches = await getNiches('np5');
    expect(niches[0]).toEqual({ rank: 1, slug: 'rust' });
  });

  it('emits a secondary niche when a second niche is above the 0.35 threshold', async () => {
    // cve + malware -> sec_threats x2 (primary)
    // openai -> ai_llm primary + sec_threats secondary
    // Result: sec_threats dominates as primary; ai_llm picks up enough secondary contribution to be #2
    await insertPost('np6', 'cve,malware,openai');
    const niches = await getNiches('np6');
    expect(niches[0]).toEqual({ rank: 1, slug: 'sec_threats' });
    expect(niches[1]?.slug).toBe('ai_llm');
  });

  it('does not emit a secondary niche when only one labeled tag is present', async () => {
    // openai has a secondaryNicheId (sec_threats) on its keyword_niche row,
    // but the post has only one labeled tag — derivation requires >=2.
    await insertPost('np7', 'openai');
    expect(await getNiches('np7')).toEqual([{ rank: 1, slug: 'ai_llm' }]);
  });

  it('dampens generic tags via weightMultiplier so a specific tag wins', async () => {
    // 'programming' -> software_craft with weightMultiplier=0.3
    // 'rust'        -> rust with weight 1.0 + 1.4 ecosystem boost
    // rust must dominate even though programming would otherwise be 1.0
    await insertPost('np8', 'programming,rust');
    const niches = await getNiches('np8');
    expect(niches[0]).toEqual({ rank: 1, slug: 'rust' });
  });

  it('recomputes niches when tagsStr is updated', async () => {
    await insertPost('np9', 'rust');
    expect(await getNiches('np9')).toEqual([{ rank: 1, slug: 'rust' }]);

    await con
      .getRepository(ArticlePost)
      .update({ id: 'np9' }, { tagsStr: 'javascript,react' });
    expect(await getNiches('np9')).toEqual([{ rank: 1, slug: 'js_ts' }]);
  });

  it('clears niches when tagsStr is cleared', async () => {
    await insertPost('np10', 'javascript,react');
    expect(await getNiches('np10')).toEqual([{ rank: 1, slug: 'js_ts' }]);

    await con
      .getRepository(ArticlePost)
      .update({ id: 'np10' }, { tagsStr: '' });
    expect(await getNiches('np10')).toEqual([{ rank: 1, slug: 'other' }]);
  });

  it('does not recompute when an unrelated post column is updated', async () => {
    await insertPost('np11', 'rust');
    const before = await con
      .getRepository(PostNiche)
      .findOneByOrFail({ postId: 'np11', rank: 1 });

    await con
      .getRepository(ArticlePost)
      .update({ id: 'np11' }, { title: 'new title' });

    const after = await con
      .getRepository(PostNiche)
      .findOneByOrFail({ postId: 'np11', rank: 1 });
    // computedAt did not advance (no recompute fired)
    expect(after.computedAt.getTime()).toEqual(before.computedAt.getTime());
  });

  it('cascades on post delete', async () => {
    await insertPost('np12', 'javascript,react');
    expect(await getNiches('np12')).toEqual([{ rank: 1, slug: 'js_ts' }]);

    await con.getRepository(ArticlePost).delete({ id: 'np12' });
    const remaining = await con
      .getRepository(PostNiche)
      .findBy({ postId: 'np12' });
    expect(remaining).toHaveLength(0);
  });

  it('is callable directly for backfill', async () => {
    // Insert without going through the trigger: do an insert, then truncate
    // post_niche to simulate a pre-existing post that hasn't been derived yet.
    await insertPost('np13', 'rust,cli');
    await con
      .getRepository(PostNiche)
      .delete({ postId: 'np13' });
    expect(await getNiches('np13')).toEqual([]);

    await con.query(
      'SELECT post_niche_recompute($1, $2)',
      ['np13', 'rust,cli'],
    );
    const niches = await getNiches('np13');
    expect(niches[0]).toEqual({ rank: 1, slug: 'rust' });
  });
});
