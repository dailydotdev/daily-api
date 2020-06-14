import { DeepPartial } from 'typeorm';
import { SourceDisplay } from '../../src/entity';

export const sourceDisplaysFixture: DeepPartial<SourceDisplay>[] = [
  { sourceId: 'a', name: 'A', image: 'http://image.com/a', enabled: true },
  { sourceId: 'b', name: 'B', image: 'http://image.com/b', enabled: true },
  { sourceId: 'c', name: 'C', image: 'http://image.com/c', enabled: true },
  {
    sourceId: 'p',
    name: 'Private',
    image: 'http://image.com/p',
    enabled: true,
    userId: '2',
  },
];
