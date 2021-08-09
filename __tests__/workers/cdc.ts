import { FastifyInstance } from 'fastify';
import nock from 'nock';

import {
  addOrRemoveSuperfeedrSubscription,
  notifySourceRequest,
} from '../../src/common';
import appFunc from '../../src/background';
import worker from '../../src/workers/cdc';
import { expectSuccessfulBackground, mockChangeMessage } from '../helpers';
import { SourceRequest } from '../../src/entity';
import { mocked } from 'ts-jest/utils';
import { ChangeObject } from '../../src/types';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  notifySourceRequest: jest.fn(),
  addOrRemoveSuperfeedrSubscription: jest.fn(),
}));

let app: FastifyInstance;

beforeAll(async () => {
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
});

describe('source request', () => {
  const base: ChangeObject<SourceRequest> = {
    id: '1',
    userName: 'idoshamun',
    userId: '1',
    userEmail: 'hi@daily.dev',
    sourceUrl: 'http://source.com',
    closed: false,
    createdAt: 0,
    updatedAt: 0,
  };

  it('should notify on new source request', async () => {
    const after: ChangeObject<SourceRequest> = base;
    await expectSuccessfulBackground(
      app,
      worker,
      mockChangeMessage<SourceRequest>({
        after,
        before: null,
        op: 'c',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'new',
      after,
    ]);
  });

  it('should notify on source request published', async () => {
    const before: ChangeObject<SourceRequest> = {
      ...base,
      approved: true,
    };
    const after: ChangeObject<SourceRequest> = {
      ...before,
      closed: true,
    };
    await expectSuccessfulBackground(
      app,
      worker,
      mockChangeMessage<SourceRequest>({
        after,
        before,
        op: 'u',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'publish',
      after,
    ]);
    expect(addOrRemoveSuperfeedrSubscription).toBeCalledWith(
      after.sourceFeed,
      after.sourceId,
      'subscribe',
    );
  });

  it('should notify on source request declined', async () => {
    const before: ChangeObject<SourceRequest> = {
      ...base,
    };
    const after: ChangeObject<SourceRequest> = {
      ...before,
      closed: true,
    };
    await expectSuccessfulBackground(
      app,
      worker,
      mockChangeMessage<SourceRequest>({
        after,
        before,
        op: 'u',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'decline',
      after,
    ]);
  });

  it('should notify on source request approve', async () => {
    const before: ChangeObject<SourceRequest> = {
      ...base,
    };
    const after: ChangeObject<SourceRequest> = {
      ...before,
      approved: true,
    };
    await expectSuccessfulBackground(
      app,
      worker,
      mockChangeMessage<SourceRequest>({
        after,
        before,
        op: 'u',
        table: 'source_request',
      }),
    );
    expect(notifySourceRequest).toBeCalledTimes(1);
    expect(mocked(notifySourceRequest).mock.calls[0].slice(1)).toEqual([
      'approve',
      after,
    ]);
  });
});
