import { expect } from 'chai';
import db, { createTables } from '../../src/db';

const createTablesAndExpect = async () => {
  await createTables();

  expect(db.schema.hasTable('posts')).to.eventually.equal(true);
  expect(db.schema.hasTable('sources')).to.eventually.equal(true);
  expect(db.schema.hasTable('publications')).to.eventually.equal(true);
};

describe('database layer', async () => {
  after(async () => {
    db.destroy();
  });

  it('should create tables when not exist', async () => {
    await db.schema.dropTableIfExists('posts');
    await db.schema.dropTableIfExists('sources');
    await db.schema.dropTableIfExists('publications');

    return createTablesAndExpect();
  });

  it('should not fail when already exist', createTablesAndExpect);
});
