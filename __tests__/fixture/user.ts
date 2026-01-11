import { DeepPartial } from 'typeorm';
import { User } from '../../src/entity';
import { SubscriptionCycles } from '../../src/paddle';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../src/notifications/common';

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
    notificationFlags: DEFAULT_NOTIFICATION_SETTINGS,
    socialLinks: [
      {
        platform: 'github',
        url: 'https://github.com/idogithub',
      },
    ],
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

export const plusUsersFixture: DeepPartial<User>[] = [
  {
    id: '5',
    name: 'Plus user',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
    username: 'plusmember',
    infoConfirmed: true,
    subscriptionFlags: { cycle: SubscriptionCycles.Yearly },
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
