const fixture = [
  {
    type: 'view',
    userId: 'user',
    postId: 'post',
    referer: null,
    agent: 'chrome',
    ip: '100.0.0.1',
    timestamp: new Date(2017, 10, 21, 15, 10, 5),
  },
  {
    type: 'share',
    userId: 'user',
    postId: 'post',
    referer: 'twitter',
    agent: 'chrome',
    ip: '100.0.0.2',
    timestamp: new Date(2017, 10, 21, 15, 11, 5),
  },
];

export default fixture;
