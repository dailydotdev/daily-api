import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import ad from '../../../src/models/ad';
import fixture from '../../fixtures/ads';

describe('post model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
  });

  it('should add new ad to db', async () => {
    const input = fixture.input[0];
    const model = await ad.add(
      input.id, input.title, input.url, input.source, input.start,
      input.end, input.image, input.ratio, input.placeholder,
    );

    expect(model).to.deep.equal(input);
  });

  it('should fetch all enabled ads', async () => {
    await Promise.all(fixture.input.map(a =>
      ad.add(
        a.id, a.title, a.url, a.source, a.start,
        a.end, a.image, a.ratio, a.placeholder,
      )));

    const models = await ad.getEnabledAds(new Date(2017, 10, 24, 15, 10, 5));
    expect(models).to.deep.equal(fixture.output);
  });
});
