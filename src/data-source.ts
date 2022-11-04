import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
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
  entities: ['src/entity/**/*.{js,ts}'],
  migrations: ['src/migration/**/*.{js,ts}'],
  subscribers: ['src/subscriber/**/*.{js,ts}'],
});
