import { getDomain } from 'tldts';

// Leaf details for `claimCorroboration.ts`: turning an evidence URL into the
// identity of WHO published it. No corroboration policy lives here — this file
// only answers "which publisher is this row", and the rule module decides what
// a set of publishers is worth.
//
// The unit is the REGISTRABLE DOMAIN, not the hostname, because a hostname
// splits one publisher into several: `elixirforum.com` and
// `forum.elixirforum.com` are one forum, and counting them as two corroborating
// sources is the false promotion this rule exists to prevent (18 claims in prod
// carried exactly that pair; 42 claims total collapse when the unit changes from
// host to registrable domain). A public-suffix list is the only correct way to
// do this — `last two labels` gets `bbc.co.uk` wrong — so it comes from tldts
// rather than a regex.

// daily.dev's own permalinks are not a publisher, they are OUR OWN PLATFORM.
//
// This is the single largest correction in the rule, and it was measured, not
// guessed: 461 of 2,415 candidate claims (19%) reached two "publishers" only
// because a daily.dev permalink stood beside the real article. Reading those
// rows explains why — 5,018 of the 5,270 daily.dev-hosted evidence rows are
// `sourceId = 'collections'`, daily.dev's roundup posts, which are DERIVED from
// the very articles they cite, and another 245 are `trends`. A Collection
// agreeing with the article it collected is one source, not two, so this is the
// ledger citing itself.
//
// Excluded rather than merged into one identity: a merged daily.dev would still
// count as the second publisher next to a real one, which is the exact failure.
// A row here contributes nothing towards corroboration.
const SELF_REFERENTIAL_DOMAINS = new Set(['daily.dev']);

// Publishers that answer to more than one registrable domain. Merged, not
// excluded — a tweet IS a source, it just is not two sources.
//
// This is the playbook's RT-mirror carve-out (§2, R21: "retweet mirrors of one
// source tweet are ONE source even with distinct postIds") in the only place it
// can be enforced mechanically. Note the carve-out is mostly FREE under the
// registrable-domain rule: every retweet of a tweet already resolves to the one
// `x.com` domain, so the entire RT class collapses without a rule. What is left
// is the rename, and only the rename, which is why this table has one row.
// Measured inert today (0 candidate claims cite both domains) and kept anyway,
// because it defends a written rule at the cost of one line.
const PUBLISHER_ALIASES = new Map<string, string>([['twitter.com', 'x.com']]);

// The publisher an evidence row speaks for, or null when the row cannot stand
// as an independent source at all — an unparseable url, or one of our own
// permalinks. Null is a real answer and the caller must drop the row, never
// count it as a distinct unknown publisher: two unparseable urls are not two
// sources.
export const evidencePublisher = (url: string): string | null => {
  const domain = getDomain(url);

  if (!domain) {
    return null;
  }

  const canonical = PUBLISHER_ALIASES.get(domain) ?? domain;

  return SELF_REFERENTIAL_DOMAINS.has(canonical) ? null : canonical;
};

// The distinct publishers behind a pile of evidence, sorted so a reason string
// built from it is stable across runs and readable in a dry-run sample.
export const distinctPublishers = (urls: string[]): string[] =>
  [...new Set(urls.map(evidencePublisher).filter((it) => it !== null))].sort();
