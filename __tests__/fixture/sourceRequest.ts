import { SourceRequest } from '../../src/entity';
import { DeepPartial } from 'typeorm';

export const sourceRequestFixture: DeepPartial<SourceRequest>[] = [
  {
    sourceUrl: 'http://1.com',
    userId: '1',
    closed: false,
    createdAt: new Date('2020-10-08T11:24:17.662Z'),
  },
  {
    sourceUrl: 'http://2.com',
    userId: '1',
    closed: true,
    approved: false,
    createdAt: new Date('2020-10-08T12:24:17.662Z'),
  },
  {
    sourceUrl: 'http://3.com',
    userId: '2',
    closed: false,
    approved: true,
    sourceId: 'a',
    sourceName: 'A',
    sourceImage: 'http://a.com',
    sourceTwitter: 'a',
    sourceFeed: 'http://a.com/feed',
    createdAt: new Date('2020-10-08T14:24:17.662Z'),
  },
];
