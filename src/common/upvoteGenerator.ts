import { Page, PageGenerator } from '../schema/common';
import { ConnectionArguments } from 'graphql-relay';
import { getCursorFromAfter } from './pagination';
import { base64 } from './base64';

export interface UpvotesPage extends Page {
  timestamp?: Date;
}

export const upvotePageGenerator: PageGenerator<
  { createdAt: Date },
  ConnectionArguments,
  UpvotesPage
> = {
  connArgsToPage: ({ first, after }: ConnectionArguments) => {
    const defaultSize = 300;
    const maxSize = 300;
    const cursor = getCursorFromAfter(after);
    const limit = Math.min(first || defaultSize, maxSize);
    if (cursor) {
      return { limit, timestamp: new Date(parseInt(cursor)) };
    }
    return { limit };
  },
  nodeToCursor: (page, _, node) => base64(`time:${node.createdAt.getTime()}`),
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!page.timestamp,
};
