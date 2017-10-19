import knex from 'knex';
import config from './config';

const db = knex({
  client: 'mysql',
  connection: config.mysql,
});

export default db;

const createPublicationsTable = async () => {
  const exists = await db.schema.hasTable('publications');
  if (!exists) {
    return db.schema.createTable('publications', (table) => {
      table.string('id').primary();
      table.string('name').unique().notNullable();
      table.string('image').notNullable();
    });
  }

  return Promise.resolve();
};

const createSourcesTable = async () => {
  const exists = await db.schema.hasTable('sources');
  if (!exists) {
    return db.schema.createTable('sources', (table) => {
      table.string('url').primary();
      table.string('publication_id').notNullable();
      table.foreign('publication_id').references('publications.id');
    });
  }

  return Promise.resolve();
};

const createPostsTable = async () => {
  const exists = await db.schema.hasTable('posts');
  if (!exists) {
    return db.schema.createTable('posts', (table) => {
      table.string('id').primary();
      table.string('title').notNullable();
      table.string('url').unique().notNullable();
      table.string('image');
      table.string('publication_id').notNullable();
      table.foreign('publication_id').references('publications.id');
      table.timestamp('published_at').notNullable();

      table.index('image');
    });
  }

  return Promise.resolve();
};

export const createTables = async () => {
  await createPublicationsTable();
  await createSourcesTable();
  return createPostsTable();
};
