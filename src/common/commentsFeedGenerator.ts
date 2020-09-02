import { GQLComment } from '../schema/comments';
import { Page, PageGenerator } from '../schema/common';
import { ConnectionArguments } from 'graphql-relay';
import { getCursorFromAfter } from './pagination';
import { base64 } from './base64';

export interface CommentsPage extends Page {
  timestamp?: Date;
}

export const commentsPageGenerator: PageGenerator<
  GQLComment,
  ConnectionArguments,
  CommentsPage
> = {
  connArgsToPage: ({ first, after }: ConnectionArguments) => {
    const cursor = getCursorFromAfter(after);
    const limit = Math.min(first || 30, 50);
    if (cursor) {
      return { limit, timestamp: new Date(parseInt(cursor)) };
    }
    return { limit };
  },
  nodeToCursor: (page, _, node) => base64(`time:${node.createdAt.getTime()}`),
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!page.timestamp,
};
