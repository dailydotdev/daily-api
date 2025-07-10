import { domainAllowedSearchParams, standardizeURL } from '../../src/common';

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
