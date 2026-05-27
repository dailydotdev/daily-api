import { DeepPartial } from 'typeorm';
import {
  Niche,
  NicheBucketGroup,
  KeywordNiche,
  Keyword,
  KeywordStatus,
} from '../../src/entity';

/**
 * Minimal niche taxonomy for trigger tests. Mirrors the production taxonomy
 * shape (ecosystem vs theme) without listing all 41.
 */
export const nichesFixture: DeepPartial<Niche>[] = [
  { slug: 'js_ts', title: 'JS/TS', bucketGroup: NicheBucketGroup.Ecosystem },
  { slug: 'rust', title: 'Rust', bucketGroup: NicheBucketGroup.Ecosystem },
  { slug: 'ai_llm', title: 'LLMs & GenAI', bucketGroup: NicheBucketGroup.Theme },
  {
    slug: 'sec_threats',
    title: 'Cyber threats',
    bucketGroup: NicheBucketGroup.Theme,
  },
  { slug: 'devtools', title: 'Dev tools', bucketGroup: NicheBucketGroup.Theme },
  {
    slug: 'software_craft',
    title: 'Software craft',
    bucketGroup: NicheBucketGroup.Theme,
  },
  { slug: 'other', title: 'Other', bucketGroup: NicheBucketGroup.Theme },
];

/**
 * Keywords used as the FK target by keywordNichesFixture. All status='allow'
 * (post.tagsStr only contains canonical allow keywords in production, and
 * keyword_niche is only seeded for allow keywords).
 */
export const nicheKeywordsFixture: DeepPartial<Keyword>[] = [
  { value: 'javascript', occurrences: 1000, status: KeywordStatus.Allow },
  { value: 'typescript', occurrences: 800, status: KeywordStatus.Allow },
  { value: 'react', occurrences: 700, status: KeywordStatus.Allow },
  { value: 'nextjs', occurrences: 300, status: KeywordStatus.Allow },
  { value: 'rust', occurrences: 200, status: KeywordStatus.Allow },
  { value: 'cli', occurrences: 500, status: KeywordStatus.Allow },
  { value: 'cve', occurrences: 200, status: KeywordStatus.Allow },
  { value: 'malware', occurrences: 200, status: KeywordStatus.Allow },
  { value: 'llm', occurrences: 1500, status: KeywordStatus.Allow },
  { value: 'openai', occurrences: 800, status: KeywordStatus.Allow },
  { value: 'programming', occurrences: 5000, status: KeywordStatus.Allow },
  { value: 'unlabeled-tag', occurrences: 1, status: KeywordStatus.Allow },
];

export type KeywordNicheLabel = {
  keyword: string;
  primarySlug: string;
  secondarySlug?: string;
  weightMultiplier?: number;
  confidence?: number;
};

/**
 * Tag -> niche labels for the trigger tests, referenced by slug. Resolved
 * to nicheIds at fixture-load time (see resolveKeywordNichesFixture).
 */
export const keywordNichesFixture: KeywordNicheLabel[] = [
  { keyword: 'javascript', primarySlug: 'js_ts' },
  { keyword: 'typescript', primarySlug: 'js_ts' },
  { keyword: 'react', primarySlug: 'js_ts' },
  { keyword: 'nextjs', primarySlug: 'js_ts' },
  { keyword: 'rust', primarySlug: 'rust' },
  { keyword: 'cli', primarySlug: 'devtools' },
  { keyword: 'cve', primarySlug: 'sec_threats' },
  { keyword: 'malware', primarySlug: 'sec_threats' },
  { keyword: 'llm', primarySlug: 'ai_llm' },
  { keyword: 'openai', primarySlug: 'ai_llm', secondarySlug: 'sec_threats' },
  // generic — should be dampened
  { keyword: 'programming', primarySlug: 'software_craft', weightMultiplier: 0.3 },
  // 'unlabeled-tag' deliberately has no keyword_niche row
];

/**
 * Build keyword_niche entity rows by resolving niche slugs -> uuids. Call
 * after nichesFixture has been saved.
 */
export const resolveKeywordNichesFixture = async (
  niches: Niche[],
): Promise<DeepPartial<KeywordNiche>[]> => {
  const idBySlug = new Map(niches.map((n) => [n.slug, n.id]));
  return keywordNichesFixture.map((l) => ({
    keyword: l.keyword,
    primaryNicheId: idBySlug.get(l.primarySlug)!,
    secondaryNicheId: l.secondarySlug
      ? idBySlug.get(l.secondarySlug)
      : undefined,
    weightMultiplier: l.weightMultiplier ?? 1,
    confidence: l.confidence ?? 3,
    labelerVersion: 'test',
  }));
};
