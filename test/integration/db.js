import { expect } from 'chai';
import db, { migrate, rollback } from '../../src/db';

const migrateAndExpect = async () => {
  await migrate();

  expect(db.schema.hasTable('posts')).to.eventually.equal(true);
  expect(db.schema.hasTable('sources')).to.eventually.equal(true);
  expect(db.schema.hasTable('publications')).to.eventually.equal(true);
};

describe('database layer', () => {
  it('should create tables when not exist', async () => {
    await rollback();
    return migrateAndExpect();
  });

  it('should not fail when already exist', migrateAndExpect);
});
