import { expect } from 'chai';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import source from '../../../src/models/source';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/sources';

describe('source model', () => {
  beforeEach(async () => {
    await dropTables();
    await createTables();
    await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image, pub.enabled)));
  });

  it('should add new source to db', async () => {
    const model = await source.add(fixture[0].publicationId, fixture[0].url);
    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch all sources from db', async () => {
    await Promise.all(fixture.map(s => source.add(s.publicationId, s.url)));
    const models = await source.getAll();
    expect(models).to.deep.equal(fixture);
  });
});
