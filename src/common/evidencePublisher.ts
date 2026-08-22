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
//
// The two tables below are the mirror carve-out, and every entry in them was
// found by SAMPLING PROMOTIONS AND READING THEM, not by imagining what a mirror
// might look like. That matters, because the tables are the one part of this
// rule that can only grow by evidence: a domain earns a row here when a
// hand-check shows it republishing someone else's article, and the measured
// cost of leaving it out is written next to it. The first dry run over prod
// promoted 1,954 claims; the three entries added after reading a 20-row sample
// removed 129 false promotions (6.6%), leaving 1,825.

// Domains that can never stand as an independent source. A row here contributes
// NOTHING towards corroboration — it is dropped, not merged onto some other
// identity, because a merged mirror would still count as the second publisher
// next to the real one, which is the exact failure.
const NON_PUBLISHER_DOMAINS = new Set([
  // Our own platform. The single largest correction in the rule, and measured
  // rather than guessed: 461 of 2,415 candidate claims (19%) reached two
  // "publishers" only because a daily.dev permalink stood beside the real
  // article. Reading the rows explains why — 5,018 of the 5,270 daily.dev
  // evidence rows are `sourceId = 'collections'`, roundup posts DERIVED from the
  // very articles they cite, and another 245 are `trends`. That is the ledger
  // citing itself.
  'daily.dev',
  // daily.dev's own link shortener, which redirects into app.daily.dev. Same
  // class as the line above and invisible to it, because the registrable domain
  // is different. Worth 7 promotions.
  'dly.to',
  // A scraper that republishes other sites' articles verbatim under the same
  // slug: `readarticle.at/when-coding-agents-forget` is
  // `dev.to/rawveg/when-coding-agents-forget-44g0`, and
  // `readarticle.at/they-taught-themselves-to-hack` is
  // `dev.to/rawveg/they-taught-themselves-to-hack-4g1`. Worth 9 promotions.
  //
  // Kept as a named domain rather than a general same-slug detector on purpose:
  // that detector was built and measured, and it flags only 7 claims across the
  // WHOLE candidate pool, so scraper mirroring is not a broad class worth a
  // heuristic that could fire on two outlets choosing the same headline.
  'readarticle.at',
]);

// Publishers that answer to more than one identity. Merged, not excluded — the
// publication is real, it just is not two sources.
//
// A key is either a registrable domain, or a domain qualified by its first path
// segment. The qualified form exists because the biggest entry needed it: only
// PART of `hey.com` is a mirror, and a domain-level rule would have been wrong.
const PUBLISHER_ALIASES = new Map<string, string>([
  // The playbook's RT-mirror carve-out (§2, R21: "retweet mirrors of one source
  // tweet are ONE source even with distinct postIds"). Note the carve-out is
  // mostly FREE under the registrable-domain rule: every retweet of a tweet
  // already resolves to the one `x.com` domain, so the entire RT class collapses
  // without a rule. What is left is the rename, and only the rename. Measured
  // inert today (0 candidate claims cite both domains) and kept anyway, because
  // it defends a written rule at the cost of one line.
  ['twitter.com', 'x.com'],
  // "This Week in Rails" is one newsletter published at two addresses, and it
  // was the single largest false-promotion class left after the daily.dev
  // exclusion — 113 claims, 4.5x the next-largest domain pair in the whole
  // candidate pool. The pairs are the same issue twice:
  // `rubyonrails.org/2025/9/26/this-week-in-rails` beside
  // `world.hey.com/this.week.in.rails/redirect-source-location-logging…`.
  //
  // Path-qualified, NOT domain-level, and this is the important part: of the 291
  // hey.com evidence rows, 287 are this newsletter but 4 are `hey.com/dhh`,
  // a genuinely separate blog. Aliasing all of hey.com would have folded a real
  // publisher away to fix a different one.
  ['hey.com/this.week.in.rails', 'rubyonrails.org'],
]);

// The first path segment of a url, used only to build the qualified alias key
// above. Empty string when there is no path, which simply never matches a key.
const firstPathSegment = (url: string): string => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean)[0] ?? '';
  } catch {
    return '';
  }
};

// The publisher an evidence row speaks for, or null when the row cannot stand
// as an independent source at all — an unparseable url, our own permalinks, or a
// scraper. Null is a real answer and the caller must drop the row, never count
// it as a distinct unknown publisher: two unparseable urls are not two sources.
export const evidencePublisher = (url: string): string | null => {
  const domain = getDomain(url);

  if (!domain) {
    return null;
  }

  // The qualified key is tried first so a rule about one section of a site beats
  // a rule about the whole of it.
  const canonical =
    PUBLISHER_ALIASES.get(`${domain}/${firstPathSegment(url)}`) ??
    PUBLISHER_ALIASES.get(domain) ??
    domain;

  return NON_PUBLISHER_DOMAINS.has(canonical) ? null : canonical;
};

// The distinct publishers behind a pile of evidence, sorted so a reason string
// built from it is stable across runs and readable in a dry-run sample.
export const distinctPublishers = (urls: string[]): string[] =>
  [...new Set(urls.map(evidencePublisher).filter((it) => it !== null))].sort();
