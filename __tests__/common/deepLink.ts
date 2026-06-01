import { createUniversalDeepLinkUrl } from '../../src/common/deepLink';

describe('createUniversalDeepLinkUrl', () => {
  it('should wrap a relative path into a deep link', () => {
    expect(createUniversalDeepLinkUrl({ url: '/posts/p1' })).toEqual(
      'http://localhost:5002/em/t/c?r=%2Fposts%2Fp1',
    );
  });

  it('should keep query and hash of the destination in the r param', () => {
    expect(
      createUniversalDeepLinkUrl({
        url: '/posts/p1?utm_source=notification&utm_medium=email#c-c1',
      }),
    ).toEqual(
      'http://localhost:5002/em/t/c?r=%2Fposts%2Fp1%3Futm_source%3Dnotification%26utm_medium%3Demail%23c-c1',
    );
  });

  it('should accept an absolute URL on the same origin', () => {
    expect(
      createUniversalDeepLinkUrl({ url: 'http://localhost:5002/posts/p1' }),
    ).toEqual('http://localhost:5002/em/t/c?r=%2Fposts%2Fp1');
  });

  it('should throw when url is empty', () => {
    expect(() => createUniversalDeepLinkUrl({ url: '' })).toThrow(
      'url is required',
    );
  });

  it('should throw when url points to an external origin', () => {
    expect(() =>
      createUniversalDeepLinkUrl({ url: 'https://evil.com/posts/p1' }),
    ).toThrow('url must be an internal link');
  });
});
