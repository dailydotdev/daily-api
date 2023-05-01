import { DeepPartial } from 'typeorm';
import { MachineSource, Source, SourceType } from '../../src/entity';

export const createSource = (
  id: string,
  name: string,
  image: string,
  type = SourceType.Machine,
  isPrivate = false,
): Source => {
  const source = new Source();
  source.id = id;
  source.name = name;
  source.image = image;
  source.active = true;
  source.private = isPrivate;
  source.handle = id;
  source.type = type;
  return source;
};

export const sourcesFixture: DeepPartial<MachineSource>[] = [
  { id: 'a', name: 'A', image: 'http://image.com/a', handle: 'a' },
  {
    id: 'b',
    rankBoost: 10,
    name: 'B',
    image: 'http://image.com/b',
    handle: 'b',
  },
  { id: 'c', name: 'C', image: 'http://image.com/c', handle: 'c' },
  {
    id: 'p',
    name: 'Private',
    image: 'http://image.com/p',
    private: true,
    active: false,
    handle: 'p',
  },
  {
    id: 'community',
    name: 'Community Picks',
    image: 'http://image.com/c',
    handle: 'community',
  },
  {
    id: 'squad',
    name: 'Squad',
    image: 'http//image.com/s',
    handle: 'squad',
    type: SourceType.Squad,
    active: true,
    private: true,
  },
];
