import { detectPlatformFromUrl } from '../../src/common/schema/socials';

describe('detectPlatformFromUrl', () => {
  it('should detect twitter.com', () => {
    expect(detectPlatformFromUrl('https://twitter.com/username')).toBe(
      'twitter',
    );
  });

  it('should detect x.com as twitter', () => {
    expect(detectPlatformFromUrl('https://x.com/username')).toBe('twitter');
  });

  it('should detect github.com', () => {
    expect(detectPlatformFromUrl('https://github.com/username')).toBe('github');
  });

  it('should detect linkedin.com', () => {
    expect(detectPlatformFromUrl('https://linkedin.com/in/username')).toBe(
      'linkedin',
    );
  });

  it('should detect www. prefixed URLs', () => {
    expect(detectPlatformFromUrl('https://www.github.com/user')).toBe('github');
  });

  it('should detect m. prefixed URLs', () => {
    expect(detectPlatformFromUrl('https://m.youtube.com/@channel')).toBe(
      'youtube',
    );
  });

  it('should detect threads.net', () => {
    expect(detectPlatformFromUrl('https://threads.net/@username')).toBe(
      'threads',
    );
  });

  it('should detect bluesky', () => {
    expect(
      detectPlatformFromUrl('https://bsky.app/profile/user.bsky.social'),
    ).toBe('bluesky');
  });

  it('should detect roadmap.sh', () => {
    expect(detectPlatformFromUrl('https://roadmap.sh/u/username')).toBe(
      'roadmap',
    );
  });

  it('should detect youtube.com', () => {
    expect(detectPlatformFromUrl('https://youtube.com/@channel')).toBe(
      'youtube',
    );
  });

  it('should detect youtu.be', () => {
    expect(detectPlatformFromUrl('https://youtu.be/video123')).toBe('youtube');
  });

  it('should detect hashnode.com', () => {
    expect(detectPlatformFromUrl('https://hashnode.com/@user')).toBe(
      'hashnode',
    );
  });

  it('should detect hashnode.dev subdomains', () => {
    expect(detectPlatformFromUrl('https://blog.hashnode.dev/post')).toBe(
      'hashnode',
    );
  });

  it('should detect mastodon instances with /@ path', () => {
    expect(detectPlatformFromUrl('https://mastodon.social/@user')).toBe(
      'mastodon',
    );
    expect(detectPlatformFromUrl('https://fosstodon.org/@user')).toBe(
      'mastodon',
    );
  });

  it('should return null for unknown domains', () => {
    expect(detectPlatformFromUrl('https://example.com/profile')).toBeNull();
    expect(detectPlatformFromUrl('https://mysite.io/about')).toBeNull();
  });

  it('should return null for invalid URLs', () => {
    expect(detectPlatformFromUrl('not-a-url')).toBeNull();
    expect(detectPlatformFromUrl('')).toBeNull();
  });
});
