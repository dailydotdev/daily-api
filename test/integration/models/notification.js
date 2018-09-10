import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import notification from '../../../src/models/notification';
import fixture from '../../fixtures/notifications';

describe('notification model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
  });

  it('should add new notification', async () => {
    const model = await notification.add(fixture[0]);
    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch notifications', async () => {
    await Promise.all(fixture.map(n => notification.add(n)));

    const model = await notification.get();
    expect(model).to.deep.equal(fixture.slice(0, 5));
  });

  it('should fetch notifications since', async () => {
    await Promise.all(fixture.map(n => notification.add(n)));

    const model = await notification.get(new Date(2017, 10, 21, 15, 58, 0));
    expect(model).to.deep.equal(fixture.slice(2, 7));
  });
});
