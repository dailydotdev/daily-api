import { expect } from 'chai';
import { migrate, rollback } from '../../../src/db';
import ad from '../../../src/models/ad';
import fixture from '../../fixtures/ads';

describe('post model', () => {
  beforeEach(async () => {
    await rollback();
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
