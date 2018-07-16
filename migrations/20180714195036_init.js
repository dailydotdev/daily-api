// eslint-disable-next-line arrow-body-style
const createPublicationsTable = async (db) => {
  return db.schema.createTable('publications', (table) => {
    table.string('id').primary();
    table.string('name').unique().notNullable();
    table.string('image').notNullable();
    table.boolean('enabled').defaultTo(0);
    table.string('twitter').nullable();

    table.index('enabled');
  });
};

// eslint-disable-next-line arrow-body-style
const createSourcesTable = async (db) => {
  return db.schema.createTable('sources', (table) => {
    table.string('url').primary();
    table.string('publication_id').notNullable();
    table.foreign('publication_id').references('publications.id');
  });
};

// eslint-disable-next-line arrow-body-style
const createPostsTable = async (db) => {
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
};

// eslint-disable-next-line arrow-body-style
const createEventsTable = async (db) => {
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
};

// eslint-disable-next-line arrow-body-style
const createConfigTable = async (db) => {
  return db.schema.createTable('config', (table) => {
    table.string('key').primary();
    table.timestamp('timestamp').nullable();
  });
};

// eslint-disable-next-line arrow-body-style
const createAdsTable = async (db) => {
  return db.schema.createTable('ads', (table) => {
    table.string('id').primary();
    table.string('title').notNullable();
    table.string('url').notNullable();
    table.string('image');
    table.float('ratio');
    table.text('placeholder');
    table.string('source');
    table.timestamp('start').defaultTo(db.fn.now());
    table.timestamp('end').defaultTo(db.fn.now());

    table.index(['start', 'end']);
  });
};

exports.up = async (knex) => {
  await createPublicationsTable(knex);
  await createSourcesTable(knex);
  await createPostsTable(knex);
  await createEventsTable(knex);
  await createConfigTable(knex);
  return createAdsTable(knex);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('posts');
  await knex.schema.dropTableIfExists('sources');
  await knex.schema.dropTableIfExists('publications');
  await knex.schema.dropTableIfExists('events');
  await knex.schema.dropTableIfExists('config');
  return knex.schema.dropTableIfExists('ads');
};
