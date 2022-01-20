export const getDiscussionLink = (postId: string): string =>
  `${process.env.COMMENTS_PREFIX}/posts/${postId}`;

const isRegexValidURL = (url: string) => {
  const res = url.match(
    /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g,
  );

  return res !== null;
};

export function isValidHttpUrl(link: string): boolean {
  let url: URL;

  try {
    url = new URL(link);
  } catch (_) {
    return false;
  }

  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    isRegexValidURL(url.href)
  );
}
