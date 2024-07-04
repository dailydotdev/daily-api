import { DeepPartial } from 'typeorm';
import { User } from '../../src/entity';

export const userCreatedDate = '2022-06-28T14:48:47.891Z';

export const usersFixture: DeepPartial<User>[] = [
  {
    id: '1',
    bio: null,
    github: 'idogithub',
    hashnode: null,
    name: 'Ido',
    image: 'https://daily.dev/ido.jpg',
    email: 'ido@daily.dev',
    createdAt: new Date(userCreatedDate),
    twitter: null,
    username: 'idoshamun',
    infoConfirmed: true,
    experienceLevel: 'LESS_THAN_1_YEAR',
  },
  {
    id: '2',
    bio: null,
    github: null,
    hashnode: null,
    name: 'Tsahi',
    email: 'tsahi@daily.dev',
    image: 'https://daily.dev/tsahi.jpg',
    createdAt: new Date(userCreatedDate),
    twitter: null,
    username: 'tsahidaily',
    infoConfirmed: true,
  },
  {
    id: '3',
    bio: null,
    github: null,
    hashnode: null,
    name: 'Nimrod',
    email: 'nimrod@daily.dev',
    image: 'https://daily.dev/nimrod.jpg',
    createdAt: new Date(userCreatedDate),
    twitter: null,
    username: 'nimroddaily',
    infoConfirmed: true,
  },
  {
    id: '4',
    bio: null,
    github: null,
    hashnode: null,
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
    twitter: null,
    username: 'lee',
    infoConfirmed: true,
  },
];
