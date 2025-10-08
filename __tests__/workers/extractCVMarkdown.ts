import type { DataSource } from 'typeorm';
import { BrokkrService, CandidatePreferenceUpdated } from '@dailydotdev/schema';
import createOrGetConnection from '../../src/db';
import {
  createMockBrokkrTransport,
  expectSuccessfulTypedBackground,
  saveFixtures,
} from '../helpers';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { extractCVMarkdown as worker } from '../../src/workers/extractCVMarkdown';
import * as brokkrCommon from '../../src/common/brokkr';
import { ConnectError, createClient } from '@connectrpc/connect';
import { UserCandidatePreference } from '../../src/entity/user/UserCandidatePreference';
import { logger } from '../../src/logger';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await saveFixtures(con, User, usersFixture);

  const mockTransport = createMockBrokkrTransport();
  jest
    .spyOn(brokkrCommon, 'getBrokkrClient')
    .mockImplementation(() => createClient(BrokkrService, mockTransport));
});

describe('extractCVMarkdown worker', () => {
  const spyLogger = jest.fn();
  beforeEach(async () => {
    await saveFixtures(con, UserCandidatePreference, [
      { userId: '1', cv: { blob: '1.pdf', bucket: '1' }, role: 'Goose farmer' },
      {
        userId: '2',
        cv: { blob: '2.pdf', bucket: '2' },
        cvParsedMarkdown: 'Already parsed',
      },
      { userId: '3' },
    ]);
  });

  it('should extract markdown from CV and update user candidate preference', async () => {
    const userId = '1';
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId: userId,
        cv: { blob: '1.pdf', bucket: userId },
      },
    });

    expect(
      await con
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId }),
    ).toMatchObject({
      userId: userId,
      role: 'Goose farmer',
      cvParsedMarkdown: null,
    });

    await expectSuccessfulTypedBackground<'api.v1.candidate-preference-updated'>(
      worker,
      payload,
    );

    expect(
      await con
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId }),
    ).toMatchObject({
      userId: userId,
      role: 'Goose farmer',
      cvParsedMarkdown: '# Extracted content for 1.pdf in 1',
    });

    expect(spyLogger).toHaveBeenCalledWith(
      { userId: userId },
      'Extracted markdown',
    );
  });

  it('should return early when markdown is already extracted', async () => {
    const userId = '2';
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId: userId,
        cv: { blob: '2.pdf', bucket: userId },
        cvParsedMarkdown: 'Already parsed',
      },
    });

    expect(
      await con
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId }),
    ).toMatchObject({
      userId: userId,
      cvParsedMarkdown: 'Already parsed',
    });

    await expectSuccessfulTypedBackground<'api.v1.candidate-preference-updated'>(
      worker,
      payload,
    );

    expect(
      await con
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId }),
    ).toMatchObject({
      userId: userId,
      cvParsedMarkdown: 'Already parsed',
    });

    expect(spyLogger).toHaveBeenCalledWith(
      'CV markdown already extracted, skipping',
    );
  });

  it('should return early when no CV is found', async () => {
    const userId = '3';
    jest.spyOn(logger, 'warn').mockImplementation(spyLogger);
    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId: userId,
      },
    });

    expect(
      await con
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId }),
    ).toMatchObject({
      userId: userId,
      cv: {},
      cvParsedMarkdown: null,
    });

    await expectSuccessfulTypedBackground<'api.v1.candidate-preference-updated'>(
      worker,
      payload,
    );

    expect(
      await con
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId }),
    ).toMatchObject({
      userId: userId,
      cv: {},
      cvParsedMarkdown: null,
    });

    expect(spyLogger).toHaveBeenCalledWith(
      { blobName: undefined, bucketName: undefined, userId: userId },
      'No CV found, skipping',
    );
  });

  it('should handle when Brokkr is unable to extract markdown', async () => {
    const userId = '3';
    jest.spyOn(logger, 'error').mockImplementation(spyLogger);
    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId: userId,
        cv: { blob: 'error.pdf', bucket: userId },
      },
    });

    await expect(
      expectSuccessfulTypedBackground<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      ),
    ).rejects.toThrow('[not_found] Not found');

    expect(
      await con
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId }),
    ).toMatchObject({
      userId: userId,
      cv: {},
      cvParsedMarkdown: null,
    });

    expect(spyLogger).toHaveBeenCalledWith(
      {
        blobName: 'error.pdf',
        bucketName: userId,
        userId: userId,
        err: expect.any(ConnectError),
      },
      'Failed to extract markdown from CV',
    );
  });
});
