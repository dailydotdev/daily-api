import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import refreshToken from '../../../src/models/refreshToken';
import fixture from '../../fixtures/refreshTokens';

describe('refresh token model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    return migrate();
  });

  it('should add new refresh token to db', async () => {
    const model = await refreshToken.add(
      fixture[0].userId,
      fixture[0].token,
    );

    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch refresh token by token', async () => {
    await refreshToken.add(
      fixture[0].userId,
      fixture[0].token,
    );
    const model = await refreshToken.getByToken(fixture[0].token);
    expect(model).to.deep.equal(fixture[0]);
  });
});
