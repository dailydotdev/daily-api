const input = [
  {
    userId: 'user1',
    theme: 'darcula',
  },
  {
    userId: 'user2',
    theme: 'darcula',
    showTopSites: true,
    enableCardAnimations: false,
  },
];

const output = [
  {
    userId: 'user1',
    theme: 'darcula',
    showTopSites: null,
    enableCardAnimations: null,
  },
  {
    userId: 'user2',
    theme: 'darcula',
    showTopSites: true,
    enableCardAnimations: false,
  },
];

export default { input, output };
