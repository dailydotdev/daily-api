const input = [
  {
    userId: 'user1',
    theme: 'darcula',
    showTopSites: false,
    enableCardAnimations: false,
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
    showTopSites: false,
    enableCardAnimations: false,
    insaneMode: false,
    appInsaneMode: true,
  },
  {
    userId: 'user2',
    theme: 'darcula',
    showTopSites: true,
    enableCardAnimations: false,
    insaneMode: false,
    appInsaneMode: true,
  },
];

export default { input, output };
