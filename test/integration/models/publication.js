import { expect } from 'chai';
import { migrate, rollback } from '../../../src/db';
import publication from '../../../src/models/publication';
import fixture from '../../fixtures/publications';

describe('publication model', () => {
  beforeEach(async () => {
    await rollback();
    return migrate();
  });

  it('should add new publication to db', async () => {
    const model = await publication.add(
      fixture[0].name,
      fixture[0].image,
      fixture[0].enabled,
      fixture[0].twitter,
    );
    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch all publications from db', async () => {
    await Promise.all(fixture.map(pub =>
      publication.add(pub.name, pub.image, pub.enabled, pub.twitter)));
    const models = await publication.getAll();
    expect(models).to.deep.equal(fixture);
  });

  it('should fetch all enabled publications from db', async () => {
    await Promise.all(fixture.map(pub =>
      publication.add(pub.name, pub.image, pub.enabled, pub.twitter)));
    const models = await publication.getEnabled();
    expect(models).to.deep.equal([fixture[0], fixture[1]]);
  });
});
