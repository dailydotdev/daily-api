import { SourceRequest } from '../../src/entity';

const createSourceRequest = (
  sourceUrl: string,
  userId: string,
  closed: boolean,
  approved?: boolean,
  sourceId?: string,
  sourceName?: string,
  sourceImage?: string,
  sourceTwitter?: string,
  sourceFeed?: string,
): SourceRequest => {
  const req = new SourceRequest();
  req.sourceUrl = sourceUrl;
  req.userId = userId;
  req.closed = closed;
  req.approved = approved;
  req.sourceId = sourceId;
  req.sourceName = sourceName;
  req.sourceImage = sourceImage;
  req.sourceTwitter = sourceTwitter;
  req.sourceFeed = sourceFeed;
  return req;
};

export const sourceRequestFixture = [
  createSourceRequest('http://1.com', '1', false),
  createSourceRequest('http://2.com', '1', true, false),
  createSourceRequest(
    'http://3.com',
    '2',
    false,
    true,
    'a',
    'A',
    'http://a.com',
    'a',
    'http://a.com/feed',
  ),
];
