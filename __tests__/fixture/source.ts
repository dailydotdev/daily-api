import { DeepPartial } from 'typeorm';
import { Source } from '../../src/entity';

export const sourcesFixture: DeepPartial<Source>[] = [
  { id: 'a' },
  { id: 'b' },
  { id: 'c' },
];
