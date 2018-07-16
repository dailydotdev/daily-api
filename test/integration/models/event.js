import { expect } from 'chai';
import { migrate, rollback } from '../../../src/db';
import event from '../../../src/models/event';
import fixture from '../../fixtures/events';

describe('event model', () => {
  beforeEach(async () => {
    await rollback();
    return migrate();
  });

  it('should add new event to db', async () => {
    const model = await event.add(
      fixture[0].type, fixture[0].userId, fixture[0].postId,
      fixture[0].referer, fixture[0].agent, fixture[0].ip, fixture[0].timestamp,
    );
    expect(model).to.deep.equal(fixture[0]);
  });

  it('should fetch all events from db', async () => {
    await Promise.all(fixture.map(e =>
      event.add(e.type, e.userId, e.postId, e.referer, e.agent, e.ip, e.timestamp)));
    const models = await event.getAll();
    expect(models).to.deep.equal(fixture);
  });
});
