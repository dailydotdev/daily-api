import { expect } from 'chai';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import fixture from '../../fixtures/publications';

describe('publication model', () => {
  beforeEach(async () => {
    await dropTables();
    return createTables();
  });

  it('should add new publication to db', async () => {
    const model = await publication.add(fixture[0].name, fixture[0].image);
    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch all publications from db', async () => {
    await publication.add(fixture[0].name, fixture[0].image);
    await publication.add(fixture[1].name, fixture[1].image);
    const models = await publication.getAll();
    expect(models).to.deep.equal(fixture);
  });
});
