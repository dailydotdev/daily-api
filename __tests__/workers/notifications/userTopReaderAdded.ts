import { DataSource } from 'typeorm';
import { userTopReaderAdded as worker } from '../../../src/workers/notifications/userTopReaderAdded';
import createOrGetConnection from '../../../src/db';
import { Keyword, User, UserTopReader } from '../../../src/entity';
import { topReadersFixture, usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeNotificationWorker, saveFixtures } from '../../helpers';
import { topReadersKeywordsFixture } from '../../fixture/keywords';
import { retryFetch } from '../../../src/integrations/retry';
import { uploadFile, UploadPreset } from '../../../src/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

jest.mock('../../../src/integrations/retry', () => ({
  ...(jest.requireActual('../../../src/integrations/retry') as Record<
    string,
    unknown
  >),
  retryFetch: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ body: Buffer.from('mocked response') }),
    ),
}));

jest.mock('../../../src/common/cloudinary', () => ({
  ...(jest.requireActual('../../../src/common/cloudinary') as Record<
    string,
    unknown
  >),
  uploadFile: jest.fn().mockImplementation(() =>
    Promise.resolve({
      url: 'http://localhost:4000/image.png',
    }),
  ),
}));

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Keyword, topReadersKeywordsFixture);
  await saveFixtures(con, UserTopReader, topReadersFixture);
});

describe('userTopReaderAdded', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should fail when it does not find the top reader', async () => {
    const payload = {
      userTopReader: {
        id: 'e6cf6f38-62a8-4c62-ae71-a3ac1c2943b8',
        userId: 'not_found',
        keywordValue: 'utp_k4',
        issuedAt: new Date(),
      },
    };

    const result = await invokeNotificationWorker(worker, payload);

    expect(result).toBeUndefined();
  });

  it('should send notification when the user has been given a top reader badge', async () => {
    const payload = {
      userTopReader: {
        id: 'e6cf6f38-62a8-4c62-ae71-a3ac1c2943b8',
        userId: '1',
        keywordValue: 'utp_k1',
        issuedAt: new Date(),
      },
    };

    await invokeNotificationWorker(worker, payload);

    expect(retryFetch).toHaveBeenCalledTimes(1);
    expect(retryFetch).toHaveBeenCalledWith(
      'http://localhost:5001/screenshot',
      {
        method: 'POST',
        body: JSON.stringify({
          url: `http://localhost:5002/imageGenerator/badges/${payload.userTopReader.id}`,
          selector: '#screenshot_wrapper',
        }),
        headers: { 'content-type': 'application/json' },
      },
    );

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect((uploadFile as jest.Mock).mock.calls[0][0]).toEqual(
      payload.userTopReader.id,
    );
    expect((uploadFile as jest.Mock).mock.calls[0][1]).toEqual(
      UploadPreset.TopReaderBadge,
    );
  });
});
