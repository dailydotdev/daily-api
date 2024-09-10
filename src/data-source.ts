import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  schema: 'public',
  synchronize: false,
  extra: {
    max: 20,
    idleTimeoutMillis: 120000,
  },
  logging: false,
  entities: ['src/entity/**/*.{js,ts}'],
  migrations: ['src/migration/**/*.{js,ts}'],
  subscribers: ['src/subscriber/**/*.{js,ts}'],
  replication: {
    defaultMode: 'master',
    master: {
      host: process.env.TYPEORM_HOST || 'localhost',
      port: 5432,
      username: process.env.TYPEORM_USER || 'postgres',
      password: process.env.TYPEORM_PASSWORD || '12345',
      database:
        process.env.TYPEORM_DATABASE ||
        (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
    },
    slaves: [
      {
        host: process.env.TYPEORM_READ_HOST || process.env.TYPEORM_HOST,
        port: 5432,
        username: process.env.TYPEORM_READ_USERNAME || 'postgres',
        password:
          process.env.TYPEORM_READ_PASSWORD || process.env.TYPEORM_PASSWORD,
        database:
          process.env.TYPEORM_READ_DATABASE ||
          (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
      },
    ],
  },
});
