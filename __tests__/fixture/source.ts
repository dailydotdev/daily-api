import { DeepPartial } from 'typeorm';
import { Source } from '../../src/entity';

export const sourcesFixture: DeepPartial<Source>[] = [
  { id: 'a' },
  { id: 'b', rankBoost: 10 },
  { id: 'c' },
  { id: 'p' },
];
