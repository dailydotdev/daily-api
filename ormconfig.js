// const dotenv = require('dotenv');
// dotenv.config({ path: `.env.production` });

module.exports = {
  type: 'postgres',
  host: process.env.TYPEORM_HOST || 'localhost',
  port: 5432,
  username: process.env.TYPEORM_USERNAME || 'postgres',
  password: process.env.TYPEORM_PASSWORD || '12345',
  schema: 'public',
  database:
    process.env.TYPEORM_DATABASE ||
    (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
  synchronize: false,
  extra: {
    max: 20,
    idleTimeoutMillis: 120000,
  },
  logging: false,
  entities: ['src/entity/**/*.ts', 'src/entity/**/*.js'],
  migrations: ['src/migration/**/*.ts', 'src/migration/**/*.js'],
  subscribers: ['src/subscriber/**/*.ts', 'src/subscriber/**/*.js'],
  cli: {
    entitiesDir: 'src/entity',
    migrationsDir: 'src/migration',
    subscribersDir: 'src/subscriber',
  },
};
