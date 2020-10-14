export const getDiscussionLink = (postId: string): string =>
  `${process.env.COMMENTS_PREFIX}/posts/${postId}`;
