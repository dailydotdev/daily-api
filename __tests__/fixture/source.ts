import { DeepPartial } from 'typeorm';
import { MachineSource } from '../../src/entity';

export const sourcesFixture: DeepPartial<MachineSource>[] = [
  { id: 'a', name: 'A', image: 'http://image.com/a' },
  { id: 'b', rankBoost: 10, name: 'B', image: 'http://image.com/b' },
  { id: 'c', name: 'C', image: 'http://image.com/c' },
  {
    id: 'p',
    name: 'Private',
    image: 'http://image.com/p',
    private: true,
    active: false,
  },
  {
    id: 'community',
    name: 'Community Picks',
    image: 'http://image.com/c',
  },
];
