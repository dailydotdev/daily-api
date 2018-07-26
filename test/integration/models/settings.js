import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import settings from '../../../src/models/settings';
import fixture from '../../fixtures/settings';

describe('settings model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    return migrate();
  });

  it('should add new settings to db', async () => {
    const model = await settings.upsert(fixture.input[0]);
    expect(model).to.deep.equal(fixture.input[0]);
  });

  it('should fetch refresh token by token', async () => {
    await Promise.all(fixture.input.map(settings.upsert));

    const model = await settings.getByUserId(fixture.input[0].userId);
    expect(model).to.deep.equal(fixture.output[0]);
  });

  it('should update existing settings to db', async () => {
    await settings.upsert(fixture.input[0]);
    await settings.upsert(Object.assign({}, fixture.input[0], { theme: 'bright' }));
    const model = await settings.getByUserId(fixture.input[0].userId);
    expect(model).to.deep.equal(Object.assign({}, fixture.output[0], { theme: 'bright' }));
  });
});
