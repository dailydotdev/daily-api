import _ from 'lodash';
import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import pubsRequest from '../../../src/models/pubsRequest';
import fixture from '../../fixtures/pubsRequests';

describe('pubs request model', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    return migrate();
  });

  it('should add and get pub request from db', async () => {
    await pubsRequest.add(fixture.input[0]);
    const model = _.omit(await pubsRequest.getById(1), ['id', 'createdAt']);
    expect(model).to.deep.equal(fixture.output[0]);
  });

  it('should get only open requests from db', async () => {
    await Promise.all(fixture.input.map(pubsRequest.add));
    const models = (await pubsRequest.getOpenRequests()).map(x => _.omit(x, ['id', 'createdAt']));
    expect(models).to.deep.equal([fixture.output[0], fixture.output[3]]);
  });

  it('should update an existing request', async () => {
    await Promise.all(fixture.input.map(pubsRequest.add));
    const models = (await pubsRequest.getOpenRequests());
    await pubsRequest.update(models[0].id, { pubId: 'id' });
    const updatedModels = (await pubsRequest.getOpenRequests()).map(x => _.omit(x, ['id', 'createdAt']));
    expect(updatedModels).to.deep.equal([
      Object.assign({}, fixture.output[0], { pubId: 'id' }),
      fixture.output[3],
    ]);
  });
});
