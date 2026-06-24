import {
  domainAllowedSearchParams,
  getUrlDedupVariants,
  getUrlTrailingSlashVariants,
  standardizeURL,
} from '../../src/common';

describe('standardizeURL', () => {
  it('should keep url without query', () => {
    const { url, canonicalUrl } = standardizeURL('https://test.com/posts/1');
    expect(url).toBe('https://test.com/posts/1');
    expect(canonicalUrl).toBe('https://test.com/posts/1');
  });

  it('should strip trailing ?', () => {
    const { url, canonicalUrl } = standardizeURL('https://test.com/posts/1?');
    expect(url).toBe('https://test.com/posts/1');
    expect(canonicalUrl).toBe('https://test.com/posts/1');
  });

  it('should preserve a trailing slash on the submitted url', () => {
    const { url, canonicalUrl } = standardizeURL(
      'https://github.com/versity/versitygw/',
    );
    expect(url).toBe('https://github.com/versity/versitygw/');
    expect(canonicalUrl).toBe('https://github.com/versity/versitygw/');
  });

  it('should clean query params', () => {
    const { url, canonicalUrl } = standardizeURL(
      'https://test.com/posts/1?utm_source=google',
    );
    expect(url).toBe('https://test.com/posts/1');
    expect(canonicalUrl).toBe('https://test.com/posts/1');
  });

  it('should keep allowed query params', () => {
    const { url, canonicalUrl } = standardizeURL(
      'https://test.com/posts/1?sk=google',
    );
    expect(url).toBe('https://test.com/posts/1?sk=google');
    expect(canonicalUrl).toBe('https://test.com/posts/1');
  });

  it('should filter out disallowed query params', () => {
    const { url, canonicalUrl } = standardizeURL(
      'https://test.com/posts/1?sk=google&foo=bar',
    );
    expect(url).toBe('https://test.com/posts/1?sk=google');
    expect(canonicalUrl).toBe('https://test.com/posts/1');
  });

  it('should keep query in excluded domains', () => {
    Object.entries(domainAllowedSearchParams).forEach(([domain, params]) => {
      const { url, canonicalUrl } = standardizeURL(
        `https://${domain}/posts/1?${Array.from(params)[0]}=lorem&foo=baz`,
      );
      expect(url).toBe(
        `https://${domain}/posts/1?${Array.from(params)[0]}=lorem`,
      );
      expect(canonicalUrl).toBe(
        `https://${domain}/posts/1?${Array.from(params)[0]}=lorem`,
      );
    });
  });
});

describe('getUrlTrailingSlashVariants', () => {
  it('should return both slash forms for a url without a trailing slash', () => {
    expect(
      getUrlTrailingSlashVariants('https://github.com/versity/versitygw'),
    ).toEqual([
      'https://github.com/versity/versitygw',
      'https://github.com/versity/versitygw/',
    ]);
  });

  it('should return both slash forms for a url with a trailing slash', () => {
    expect(
      getUrlTrailingSlashVariants('https://github.com/versity/versitygw/'),
    ).toEqual([
      'https://github.com/versity/versitygw',
      'https://github.com/versity/versitygw/',
    ]);
  });

  it('should collapse multiple trailing slashes', () => {
    expect(
      getUrlTrailingSlashVariants('https://github.com/versity/versitygw//'),
    ).toEqual([
      'https://github.com/versity/versitygw',
      'https://github.com/versity/versitygw/',
    ]);
  });

  it('should preserve query params on both forms', () => {
    expect(
      getUrlTrailingSlashVariants('https://test.com/posts/1/?sk=google'),
    ).toEqual([
      'https://test.com/posts/1?sk=google',
      'https://test.com/posts/1/?sk=google',
    ]);
  });

  it('should not toggle a root url', () => {
    expect(getUrlTrailingSlashVariants('https://github.com/')).toEqual([
      'https://github.com/',
    ]);
  });
});

describe('getUrlDedupVariants', () => {
  it('should cross www and trailing-slash variants', () => {
    expect(
      getUrlDedupVariants('https://github.com/versity/versitygw/'),
    ).toEqual([
      'https://github.com/versity/versitygw',
      'https://github.com/versity/versitygw/',
      'https://www.github.com/versity/versitygw',
      'https://www.github.com/versity/versitygw/',
    ]);
  });
});
