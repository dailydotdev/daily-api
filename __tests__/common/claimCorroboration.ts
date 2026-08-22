import { corroborationVerdict } from '../../src/common/claimCorroboration';
import {
  distinctPublishers,
  evidencePublisher,
} from '../../src/common/evidencePublisher';
import { ClaimEvidenceSourceClass } from '../../src/entity/claim/ClaimEvidence';

const community = (url: string) => ({
  url,
  sourceClass: ClaimEvidenceSourceClass.Community,
});
const vendor = (url: string) => ({
  url,
  sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
});

describe('evidencePublisher', () => {
  it('should identify a publisher by registrable domain, not hostname', () => {
    // The measured case: `elixirforum.com` and `forum.elixirforum.com` are one
    // forum, and a hostname unit would have counted them as two sources.
    expect(evidencePublisher('https://forum.elixirforum.com/t/1')).toEqual(
      'elixirforum.com',
    );
    expect(evidencePublisher('https://elixirforum.com/t/1')).toEqual(
      'elixirforum.com',
    );
  });

  it('should use the public suffix list rather than the last two labels', () => {
    expect(evidencePublisher('https://www.bbc.co.uk/news/1')).toEqual(
      'bbc.co.uk',
    );
    expect(evidencePublisher('https://omgubuntu.co.uk/post')).toEqual(
      'omgubuntu.co.uk',
    );
  });

  it('should refuse daily.dev permalinks as a publisher at all', () => {
    // Our own platform: these are `collections`/`trends` roundups derived from
    // the very posts they cite, so counting them is the ledger citing itself.
    expect(
      evidencePublisher('https://app.daily.dev/posts/8Gcz1p1Kb'),
    ).toBeNull();
    expect(
      evidencePublisher('https://daily.dev/posts/ghost-6-expands'),
    ).toBeNull();
  });

  it('should treat x.com and twitter.com as one publisher', () => {
    expect(evidencePublisher('https://twitter.com/foo/status/1')).toEqual(
      'x.com',
    );
    expect(evidencePublisher('https://x.com/foo/status/1')).toEqual('x.com');
  });

  it('should return null for a url it cannot parse', () => {
    expect(evidencePublisher('not a url')).toBeNull();
    expect(evidencePublisher('')).toBeNull();
  });

  it('should not let two unnameable rows look like two publishers', () => {
    expect(distinctPublishers(['not a url', 'also not a url'])).toEqual([]);
  });
});

describe('corroborationVerdict', () => {
  it('should corroborate a claim two independent publishers assert', () => {
    expect(
      corroborationVerdict([
        community('https://techcrunch.com/2025/08/05/ghost'),
        community('https://blog.cloudflare.com/local-tracing'),
      ]),
    ).toMatchObject({
      corroborated: true,
      reason: 'distinct_publishers',
      publishers: ['cloudflare.com', 'techcrunch.com'],
    });
  });

  it('should NOT corroborate one publisher posting twice', () => {
    // The settled reading of playbook §2: "independent" beats "distinct posts".
    // This is the Babel shape from product-wiki §6h — two babeljs.io release
    // posts are two posts but one source.
    expect(
      corroborationVerdict([
        community('https://babeljs.io/blog/2026/01/01/7.29.0'),
        community('https://babeljs.io/blog/2026/02/02/8.0.0'),
      ]),
    ).toMatchObject({ corroborated: false, reason: 'single_publisher' });
  });

  it('should NOT corroborate a subdomain of the same publisher', () => {
    expect(
      corroborationVerdict([
        community('https://elixirforum.com/t/release/1'),
        community('https://forum.elixirforum.com/t/release/1'),
      ]),
    ).toMatchObject({ corroborated: false, reason: 'single_publisher' });
  });

  it('should NOT corroborate a real article plus our own daily.dev mirror', () => {
    // 461 candidate claims in prod reached two "publishers" only this way.
    expect(
      corroborationVerdict([
        community('https://blog.cloudflare.com/local-tracing'),
        community('https://app.daily.dev/posts/8Gcz1p1Kb'),
      ]),
    ).toMatchObject({
      corroborated: false,
      reason: 'single_publisher',
      publishers: ['cloudflare.com'],
    });
  });

  it('should collapse an RT mirror onto its source tweet (playbook R21)', () => {
    expect(
      corroborationVerdict([
        community('https://twitter.com/vercel/status/1'),
        community('https://x.com/someoneelse/status/2'),
      ]),
    ).toMatchObject({ corroborated: false, reason: 'single_publisher' });
  });

  it('should report no independent evidence when nothing names a publisher', () => {
    expect(
      corroborationVerdict([community('https://app.daily.dev/posts/A')]),
    ).toMatchObject({
      corroborated: false,
      reason: 'no_independent_evidence',
      publishers: [],
    });
  });

  it('should ignore sourceClass by default, so a relabel cannot promote', () => {
    // Law 3: "sourceClass upgrades never promote". Same two urls, one relabelled
    // vendor_changelog — the verdict must not move.
    const urls = [
      'https://babeljs.io/blog/a',
      'https://babeljs.io/blog/b',
    ] as const;

    expect(
      corroborationVerdict([community(urls[0]), community(urls[1])]),
    ).toMatchObject({ corroborated: false });
    expect(
      corroborationVerdict([vendor(urls[0]), community(urls[1])]),
    ).toMatchObject({ corroborated: false });
  });

  describe('vendor cross-class branch (opt-in)', () => {
    it('should corroborate vendor + community from one publisher when enabled', () => {
      expect(
        corroborationVerdict(
          [
            vendor('https://babeljs.io/blog/8.0.0'),
            community('https://babeljs.io/blog/breakage'),
          ],
          { allowVendorCrossClass: true },
        ),
      ).toMatchObject({ corroborated: true, reason: 'vendor_cross_class' });
    });

    it('should still require a second row of a different class', () => {
      expect(
        corroborationVerdict(
          [
            vendor('https://babeljs.io/blog/8.0.0'),
            vendor('https://babeljs.io/blog/8.0.1'),
          ],
          { allowVendorCrossClass: true },
        ),
      ).toMatchObject({ corroborated: false, reason: 'single_publisher' });
    });

    it('should not let a daily.dev mirror satisfy the community half', () => {
      expect(
        corroborationVerdict(
          [
            vendor('https://babeljs.io/blog/8.0.0'),
            community('https://app.daily.dev/posts/A'),
          ],
          { allowVendorCrossClass: true },
        ),
      ).toMatchObject({ corroborated: false });
    });
  });
});
