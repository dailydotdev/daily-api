import { expect } from 'chai';
import db, { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';

describe('publication model', async () => {
  beforeEach(async () => {
    await dropTables();
    return createTables();
  });

  after(async () => {
    db.destroy();
  });

  it('should add new publication to db', async () => {
    const model = await publication.add('Publication', 'https://cdn.com/images/pub.png');
    expect(model).to.deep.equal({ id: 'publication', name: 'Publication', image: 'https://cdn.com/images/pub.png' });
  });

  it('should fetch all publications from db', async () => {
    await publication.add('Publication', 'https://cdn.com/images/pub.png');
    await publication.add('TEM\'s Blog', 'https://cdn.com/images/blog.png');
    const models = await publication.getAll();
    expect(models).to.deep.equal([
      { id: 'publication', name: 'Publication', image: 'https://cdn.com/images/pub.png' },
      { id: 'tems_blog', name: 'TEM\'s Blog', image: 'https://cdn.com/images/blog.png' },
    ]);
  });
});
