import { excludeFromStandardization, standardizeURL } from '../../src/common';

describe('standardizeURL', () => {
  it('should keep url without query', () => {
    expect(standardizeURL('https://test.com/posts/1')).toBe(
      'https://test.com/posts/1',
    );
  });

  it('should strip trailing ?', () => {
    expect(standardizeURL('https://test.com/posts/1?')).toBe(
      'https://test.com/posts/1',
    );
  });

  it('should clean query params', () => {
    expect(standardizeURL('https://test.com/posts/1?utm_source=google')).toBe(
      'https://test.com/posts/1',
    );
  });

  it('should keep query in excluded domains', () => {
    excludeFromStandardization.forEach((domain) => {
      expect(
        standardizeURL(`https://${domain}/posts/1?utm_source=google`),
      ).toBe(`https://${domain}/posts/1?utm_source=google`);
    });
  });
});
