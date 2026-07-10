import { CONTRIBUTION_ACTION_COMPLETED_CHANNEL } from '../../src/common/contribution';
import { ContributionSubmissionStatus } from '../../src/entity/contribution/ContributionSubmission';
import { redisPubSub } from '../../src/redis';
import worker from '../../src/workers/contributionActionCompletedRealTime';
import { typedWorkers } from '../../src/workers';
import { expectSuccessfulTypedBackground } from '../helpers';

beforeEach(() => {
  jest.resetAllMocks();
});

describe('contributionActionCompletedRealTime worker', () => {
  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should broadcast the completion to the global redis channel', async () => {
    const publishSpy = jest.spyOn(redisPubSub, 'publish');
    const submission = {
      id: 'sub-1',
      userId: 'user-1',
      actionId: 'action-1',
      awardedPoints: 50,
      status: ContributionSubmissionStatus.Approved,
      evidence: '{}',
      flags: '{}',
      paymentId: null,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: 0,
      updatedAt: 0,
    };

    await expectSuccessfulTypedBackground<'api.v1.contribution-action-completed'>(
      worker,
      { submission },
    );

    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith(
      CONTRIBUTION_ACTION_COMPLETED_CHANNEL,
      {
        submissionId: 'sub-1',
        userId: 'user-1',
        actionId: 'action-1',
        awardedPoints: 50,
      },
    );
  });
});
