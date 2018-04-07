import _ from 'lodash';
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
      table.boolean('enabled').defaultTo(0);
      table.string('twitter').nullable();

      table.index('enabled');
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
      table.float('ratio');
      table.text('placeholder');
      table.string('publication_id').notNullable();
      table.foreign('publication_id').references('publications.id');
      table.timestamp('published_at').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.boolean('tweeted').defaultTo(0);
      table.integer('views').defaultTo(0);
      table.boolean('promoted').defaultTo(0);

      table.index('image');
      table.index('tweeted');
      // TODO: index should be DESC
      table.index('created_at');
      table.index('views');
      table.index(['views', 'created_at']);
      table.index('promoted');
    });
  }

  return Promise.resolve();
};

const createEventsTable = async () => {
  const exists = await db.schema.hasTable('events');
  if (!exists) {
    return db.schema.createTable('events', (table) => {
      table.string('type').notNullable();
      table.string('referer').nullable();
      table.string('agent').nullable();
      table.string('ip').nullable();
      table.string('user_id').notNullable();
      table.string('post_id').notNullable();
      table.timestamp('timestamp').defaultTo(db.fn.now());

      table.index('type');
      table.index('user_id');
      table.index('post_id');
      table.index(['type', 'timestamp']);
    });
  }

  return Promise.resolve();
};

const createConfigTable = async () => {
  const exists = await db.schema.hasTable('config');
  if (!exists) {
    return db.schema.createTable('config', (table) => {
      table.string('key').primary();
      table.timestamp('timestamp').nullable();
    });
  }

  return Promise.resolve();
};

export const createTables = async () => {
  await createPublicationsTable();
  await createSourcesTable();
  await createPostsTable();
  await createEventsTable();
  await createConfigTable();
};

export const dropTables = async () => {
  await db.schema.dropTableIfExists('posts');
  await db.schema.dropTableIfExists('sources');
  await db.schema.dropTableIfExists('publications');
  await db.schema.dropTableIfExists('events');
  await db.schema.dropTableIfExists('config');
};

export const toCamelCase = obj => _.mapKeys(obj, (value, key) => _.camelCase(key));
export const toSnakeCase = obj => _.mapKeys(obj, (value, key) => _.snakeCase(key));
