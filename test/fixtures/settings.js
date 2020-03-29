const input = [
  {
    userId: 'user1',
    theme: 'darcula',
    showTopSites: false,
    enableCardAnimations: false,
    showOnlyNotReadPosts: true,
  },
  {
    userId: 'user2',
    theme: 'darcula',
    showTopSites: true,
    enableCardAnimations: false,
    spaciness: 'roomy',
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
    spaciness: 'eco',
    showOnlyNotReadPosts: true,
  },
  {
    userId: 'user2',
    theme: 'darcula',
    showTopSites: true,
    enableCardAnimations: false,
    insaneMode: false,
    appInsaneMode: true,
    spaciness: 'roomy',
    showOnlyNotReadPosts: false,
  },
];

export default { input, output };
