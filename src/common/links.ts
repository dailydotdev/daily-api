const excludeFromStandardization = ['youtube.com'];

const isExcluded = (url: string) =>
  excludeFromStandardization.some((e) => url.includes(e));

const subtractDomain = (url: string): string => {
  const matches = url.match(
    /^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/i,
  );
  return matches && matches[1];
};

export const getDiscussionLink = (postId: string): string =>
  `${process.env.COMMENTS_PREFIX}/posts/${postId}`;

export const standardizeURL = (url: string): string => {
  const domain = subtractDomain(url);
  if (!isExcluded(domain)) {
    return url.split('?')[0];
  }

  return url;
};

export function isValidHttpUrl(link: string): boolean {
  let url: URL;

  try {
    url = new URL(link);
  } catch (_) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
}
