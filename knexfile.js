module.exports = {
  [process.env.NODE_ENV || 'development']: {
    client: 'mysql',
    connection: {
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    },
  },
};
