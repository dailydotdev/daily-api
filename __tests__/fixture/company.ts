import type { DeepPartial } from 'typeorm';
import type { Company } from '../../src/entity/Company';

export const companyFixture: DeepPartial<Company>[] = [
  {
    id: 'dailydev',
    name: 'daily.dev',
    image: 'cloudinary.com/dailydev/121232121/image',
    domains: ['daily.dev', 'dailydev.com'],
  },
];
