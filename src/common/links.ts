export const getDiscussionLink = (postId: string): string =>
  `${process.env.COMMENTS_PREFIX}/posts/${postId}`;

export function isValidHttpUrl(link: string): boolean {
  try {
    const url = new URL(link);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}
