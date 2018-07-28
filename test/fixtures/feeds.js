import publications from './publications';

const fixture = [
  {
    userId: 'user1',
    publicationId: publications[0].id,
    enabled: true,
  },
  {
    userId: 'user1',
    publicationId: publications[1].id,
    enabled: false,
  },
  {
    userId: 'user1',
    publicationId: publications[2].id,
    enabled: true,
  },
  {
    userId: 'user2',
    publicationId: publications[2].id,
    enabled: false,
  },
  {
    userId: 'user1',
    publicationId: publications[2].id,
    enabled: false,
  },
];

export default fixture;
