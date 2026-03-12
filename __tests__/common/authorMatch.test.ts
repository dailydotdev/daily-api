import { isAuthorMatchDomainIgnored } from '../../src/common/authorMatch';

describe('isAuthorMatchDomainIgnored', () => {
  it('matches exact domains, subdomains, and ignores malformed or unrelated urls', () => {
    expect(
      isAuthorMatchDomainIgnored({
        urls: ['https://example.com/post'],
        ignoredDomains: ['example.com'],
      }),
    ).toBe(true);

    expect(
      isAuthorMatchDomainIgnored({
        urls: ['https://blog.example.com/post'],
        ignoredDomains: ['example.com'],
      }),
    ).toBe(true);

    expect(
      isAuthorMatchDomainIgnored({
        urls: ['https://notexample.com/post', 'not-a-url'],
        ignoredDomains: ['example.com'],
      }),
    ).toBe(false);

    expect(
      isAuthorMatchDomainIgnored({
        urls: ['https://example.com/post'],
        ignoredDomains: [],
      }),
    ).toBe(false);
  });
});
