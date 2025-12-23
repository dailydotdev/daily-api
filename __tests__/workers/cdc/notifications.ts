import nock from 'nock';
import worker from '../../../src/workers/cdc/notifications';
import { NotificationV2 } from '../../../src/entity';
import { randomUUID } from 'crypto';
import { ChangeObject } from '../../../src/types';
import { NotificationType } from '../../../src/notifications/common';
import { expectSuccessfulBackground, mockChangeMessage } from '../../helpers';
import { notifyNewNotification } from '../../../src/common';

jest.mock('../../../src/common', () => ({
  ...(jest.requireActual('../../../src/common') as Record<string, unknown>),
  notifyNewNotification: jest.fn(),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
});

describe('notification', () => {
  type ObjectType = NotificationV2;
  const id = randomUUID();
  const base: ChangeObject<ObjectType> = {
    id,
    type: NotificationType.CommunityPicksSucceeded,
    title: 'hello',
    targetUrl: 'target',
    icon: 'icon',
    public: true,
    createdAt: Date.now(),
    attachments: [],
    avatars: [],
  };

  it('should notify new notification', async () => {
    const after: ChangeObject<ObjectType> = base;
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage<ObjectType>({
        after,
        before: null,
        op: 'c',
        table: 'notification_v2',
      }),
    );
    expect(notifyNewNotification).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifyNewNotification).mock.calls[0].slice(1)).toEqual([
      after,
    ]);
  });
});
