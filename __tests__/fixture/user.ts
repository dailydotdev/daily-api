import type { DeepPartial } from 'typeorm';
import type { User, UserTopReader } from '../../src/entity';
import { topReadersKeywordsFixture } from './keywords';

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

export const badUsersFixture: DeepPartial<User>[] = [
  {
    id: 'vordr',
    bio: null,
    github: null,
    hashnode: null,
    name: 'Vordr was here',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
    twitter: null,
    username: 'vordr',
    infoConfirmed: true,
    flags: {
      vordr: true,
      trustScore: 1,
    },
  },
  {
    id: 'low-score',
    bio: null,
    github: null,
    hashnode: null,
    name: 'Low Score',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
    twitter: null,
    username: 'low-score',
    infoConfirmed: true,
    flags: {
      vordr: false,
      trustScore: 0,
    },
  },
  {
    id: 'low-reputation',
    bio: null,
    github: null,
    hashnode: null,
    name: 'Low Reputation',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
    twitter: null,
    username: 'low-reputation',
    infoConfirmed: true,
    reputation: 0,
    flags: {
      vordr: false,
      trustScore: 1,
    },
  },
];

export const topReadersFixture: Partial<UserTopReader>[] = [
  {
    id: 'e6cf6f38-62a8-4c62-ae71-a3ac1c2943b8',
    userId: usersFixture[0].id,
    keywordValue: topReadersKeywordsFixture[0].value,
    issuedAt: new Date(),
  },
  {
    id: '200caed4-ea41-461d-9aa2-6a5ae1ffe44c',
    userId: usersFixture[1].id,
    keywordValue: topReadersKeywordsFixture[1].value,
    issuedAt: new Date(),
  },
  {
    id: '91c7df4b-f2a9-4613-85f6-d96e2a91222e',
    userId: usersFixture[2].id,
    keywordValue: topReadersKeywordsFixture[2].value,
    issuedAt: new Date(),
  },
];
