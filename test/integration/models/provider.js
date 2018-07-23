import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import provider from '../../../src/models/provider';
import fixture from '../../fixtures/providers';

describe('provider model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    return migrate();
  });

  it('should add new provider to db', async () => {
    const model = await provider.add(
      fixture[0].userId,
      fixture[0].provider,
      fixture[0].accessToken,
      fixture[0].providerId,
      fixture[0].expiresIn,
      fixture[0].refreshToken,
    );

    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch provider by user id and provider name', async () => {
    await provider.add(
      fixture[0].userId,
      fixture[0].provider,
      fixture[0].accessToken,
      fixture[0].providerId,
      fixture[0].expiresIn,
      fixture[0].refreshToken,
    );
    const model = await provider.getByUserId(fixture[0].userId);
    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch provider by provider id and provider name', async () => {
    await provider.add(
      fixture[0].userId,
      fixture[0].provider,
      fixture[0].accessToken,
      fixture[0].providerId,
      fixture[0].expiresIn,
      fixture[0].refreshToken,
    );
    const model = await provider.getByProviderId(fixture[0].providerId, fixture[0].provider);
    expect(model).to.deep.equal(fixture[0]);
  });

  it('should update existing provider', async () => {
    await provider.add(
      fixture[0].userId,
      fixture[0].provider,
      fixture[0].accessToken,
      fixture[0].providerId,
      fixture[0].expiresIn,
      fixture[0].refreshToken,
    );
    await provider.updateToken(fixture[0].userId, fixture[0].provider, 'new_token');
  });
});
