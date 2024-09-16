import { ContentUpdatedMessage } from '@dailydotdev/schema';
import { publishEvent, pubsub } from '../../src/common/pubsub';
import { logger } from '../../src/logger';

describe('publishEvent', () => {
  beforeEach(() => {
    process.env.ENABLE_PUBSUB = 'true';
  });

  afterEach(() => {
    delete process.env.ENABLE_PUBSUB;
  });

  it('should publish JSON message', async () => {
    const topic = pubsub.topic('api.v1.test');
    topic.publishMessage = jest.fn();

    await publishEvent(logger, topic, { test: 'data' });

    expect(topic.publishMessage).toHaveBeenCalledTimes(1);
    expect(topic.publishMessage).toHaveBeenCalledWith({
      json: {
        test: 'data',
      },
    });
  });

  it('should publish protobuf message', async () => {
    const topic = pubsub.topic('api.v1.test');
    topic.publishMessage = jest.fn();

    await publishEvent(logger, topic, new ContentUpdatedMessage());

    expect(topic.publishMessage).toHaveBeenCalledTimes(1);
    expect(topic.publishMessage).toHaveBeenCalledWith({
      data: expect.any(Buffer),
    });
  });
});
