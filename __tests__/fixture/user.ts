import { DeepPartial } from 'typeorm';
import { User, type HotTake } from '../../src/entity';
import { SubscriptionCycles } from '../../src/paddle';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../src/notifications/common';

export const userCreatedDate = '2022-06-28T14:48:47.891Z';

export const usersFixture: DeepPartial<User>[] = [
  {
    id: '1',
    bio: null,
    name: 'Ido',
    image: 'https://daily.dev/ido.jpg',
    email: 'ido@daily.dev',
    createdAt: new Date(userCreatedDate),
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
    name: 'Tsahi',
    email: 'tsahi@daily.dev',
    image: 'https://daily.dev/tsahi.jpg',
    createdAt: new Date(userCreatedDate),
    username: 'tsahidaily',
    infoConfirmed: true,
  },
  {
    id: '3',
    bio: null,
    name: 'Nimrod',
    email: 'nimrod@daily.dev',
    image: 'https://daily.dev/nimrod.jpg',
    createdAt: new Date(userCreatedDate),
    username: 'nimroddaily',
    infoConfirmed: true,
  },
  {
    id: '4',
    bio: null,
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
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
    name: 'Vordr was here',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
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
    name: 'Low Score',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
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
    name: 'Low Reputation',
    image: 'https://daily.dev/lee.jpg',
    createdAt: new Date(userCreatedDate),
    username: 'low-reputation',
    infoConfirmed: true,
    reputation: 0,
    flags: {
      vordr: false,
      trustScore: 1,
    },
  },
];

export const hotTakeFixture: DeepPartial<HotTake>[] = [
  {
    userId: '1',
    emoji: '🍕',
    title: 'Cold pizza is a valid breakfast',
    subtitle: 'It is efficient, not sad.',
    position: 1,
    upvotes: 72,
  },
  {
    userId: '2',
    emoji: '☕',
    title: 'Decaf is still coffee',
    subtitle: 'Sometimes you want the taste, not the panic.',
    position: 1,
    upvotes: 41,
  },
  {
    userId: '2',
    emoji: '🧊',
    title: 'Ice in drinks is a scam',
    subtitle: 'I asked for a beverage, not a geometry lesson.',
    position: 1,
    upvotes: 64,
  },
  {
    userId: '2',
    emoji: '🍫',
    title: 'Chocolate belongs in the fridge',
    subtitle: 'Crunch is the point.',
    position: 1,
    upvotes: 37,
  },
  {
    userId: '3',
    emoji: '📱',
    title: 'Dark mode is mostly vibes',
    subtitle: 'Light mode isn’t a moral failing.',
    position: 1,
    upvotes: 58,
  },
  {
    userId: '4',
    emoji: '🛌',
    title: 'Naps are a legitimate hobby',
    subtitle: 'If it restores stats, it counts.',
    position: 1,
    upvotes: 89,
  },
  {
    userId: '4',
    emoji: '📵',
    title: 'Push notifications should be opt-in, not default',
    subtitle: 'My phone is not a dispatcher.',
    position: 1,
    upvotes: 95,
  },
  {
    userId: '4',
    emoji: '🧺',
    title: 'Laundry is just a recurring side quest',
    subtitle: 'The loot is clean socks.',
    position: 1,
    upvotes: 0,
  },
];
