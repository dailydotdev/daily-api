import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from '../../helpers';
import { User } from '../../../src/entity';
import { Feedback, FeedbackStatus } from '../../../src/entity/Feedback';
import { usersFixture } from '../../fixture';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import request from 'supertest';
import { createHmac } from 'crypto';
import { NotificationV2, UserNotification } from '../../../src/entity';
import { NotificationType } from '../../../src/notifications/common';
import { UserFeedbackCategory } from '@dailydotdev/schema';
import { FeedbackReply } from '../../../src/entity/FeedbackReply';
import * as mailing from '../../../src/common/mailing';

let app: FastifyInstance;
let con: DataSource;

const generateLinearSignature = (
  body: object,
  secret: string = process.env.LINEAR_WEBHOOK_SECRET as string,
): string => {
  const hmac = createHmac('sha256', secret);
  hmac.update(JSON.stringify(body));
  return hmac.digest('hex');
};

const withLinearSignature = (
  req: request.Test,
  body: object,
  secret?: string,
): request.Test => {
  const signature = generateLinearSignature(body, secret);
  return req.set('linear-signature', signature);
};

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  jest.spyOn(mailing, 'sendEmail').mockResolvedValue();
  await saveFixtures(con, User, usersFixture);
});

const createFeedback = async (
  overrides: Partial<Feedback> = {},
): Promise<Feedback> => {
  const feedback = con.getRepository(Feedback).create({
    userId: '1',
    category: UserFeedbackCategory.BUG,
    description: 'Test feedback description',
    status: FeedbackStatus.Processing,
    linearIssueId: 'linear-issue-123',
    ...overrides,
  });
  return con.getRepository(Feedback).save(feedback);
};

const expectFeedbackNotification = async (
  feedbackId: string,
  type: NotificationType,
): Promise<void> => {
  const notification = await con.getRepository(NotificationV2).findOne({
    where: {
      type,
      referenceId: feedbackId,
    },
  });
  expect(notification).toBeTruthy();
  expect(notification?.referenceType).toEqual('feedback');

  if (!notification) {
    throw new Error('Expected feedback notification');
  }

  const userNotification = await con.getRepository(UserNotification).findOne({
    where: {
      userId: '1',
      notificationId: notification.id,
    },
  });
  expect(userNotification).toBeTruthy();
};

describe('POST /webhooks/linear', () => {
  describe('signature verification', () => {
    it('should return 403 when no linear-signature header', async () => {
      const payload = {
        action: 'update',
        type: 'Issue',
        data: { id: 'linear-issue-123', state: { id: 's1', name: 'Done' } },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .expect(403);

      expect(body.error).toEqual('Invalid signature');
    });

    it('should return 403 when signature is invalid', async () => {
      const payload = {
        action: 'update',
        type: 'Issue',
        data: { id: 'linear-issue-123', state: { id: 's1', name: 'Done' } },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .set('linear-signature', 'invalid-signature')
        .send(payload)
        .expect(403);

      expect(body.error).toEqual('Invalid signature');
    });

    it('should return 200 when signature is valid', async () => {
      const payload = {
        action: 'update',
        type: 'Issue',
        data: { id: 'non-existent-issue', state: { id: 's1', name: 'Done' } },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);
    });
  });

  describe('event filtering', () => {
    it('should ignore non-Issue events', async () => {
      await createFeedback();
      const payload = {
        action: 'update',
        type: 'Comment',
        data: { id: 'linear-issue-123', state: { id: 's1', name: 'Done' } },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const feedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(feedback?.status).toEqual(FeedbackStatus.Processing);
    });

    it('should ignore non-update actions', async () => {
      await createFeedback();
      const payload = {
        action: 'create',
        type: 'Issue',
        data: { id: 'linear-issue-123', state: { id: 's1', name: 'Done' } },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const feedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(feedback?.status).toEqual(FeedbackStatus.Processing);
    });

    it('should ignore events without state change', async () => {
      await createFeedback();
      const payload = {
        action: 'update',
        type: 'Issue',
        data: { id: 'linear-issue-123', state: { id: 's1', name: 'Done' } },
        // No updatedFrom.stateId means no state change
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const feedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(feedback?.status).toEqual(FeedbackStatus.Processing);
    });

    it('should ignore issues not linked to feedback', async () => {
      const payload = {
        action: 'update',
        type: 'Issue',
        data: {
          id: 'non-feedback-issue',
          state: { id: 's1', name: 'Done' },
        },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);
    });

    it('should ignore unmapped state names', async () => {
      await createFeedback();
      const payload = {
        action: 'update',
        type: 'Issue',
        data: {
          id: 'linear-issue-123',
          state: { id: 's1', name: 'Custom State' },
        },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const feedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(feedback?.status).toEqual(FeedbackStatus.Processing);
    });

    it('should ignore comment create events without @reply prefix', async () => {
      await createFeedback();
      const payload = {
        action: 'create',
        type: 'Comment',
        data: {
          id: 'comment-123',
          body: 'Thanks team',
          issue: { id: 'linear-issue-123' },
          user: { name: 'Chris', email: 'chris@daily.dev' },
        },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const replies = await con.getRepository(FeedbackReply).find();
      expect(replies).toHaveLength(0);
      expect(mailing.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('status mapping', () => {
    it('should ignore "In Progress" state (no longer mapped)', async () => {
      await createFeedback();
      const payload = {
        action: 'update',
        type: 'Issue',
        data: {
          id: 'linear-issue-123',
          state: { id: 's1', name: 'In Progress' },
        },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const feedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      // Status should remain unchanged (Processing)
      expect(feedback?.status).toEqual(FeedbackStatus.Processing);
    });

    it('should update status to Cancelled and create notification when state is "Canceled"', async () => {
      const feedback = await createFeedback();
      const payload = {
        action: 'update',
        type: 'Issue',
        data: {
          id: 'linear-issue-123',
          state: { id: 's1', name: 'Canceled' },
        },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const updatedFeedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(updatedFeedback?.status).toEqual(FeedbackStatus.Cancelled);

      await expectFeedbackNotification(
        feedback.id,
        NotificationType.FeedbackCancelled,
      );
    });

    it('should update status to Completed and create notification when state is "Done"', async () => {
      const feedback = await createFeedback();
      const payload = {
        action: 'update',
        type: 'Issue',
        data: { id: 'linear-issue-123', state: { id: 's1', name: 'Done' } },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const updatedFeedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(updatedFeedback?.status).toEqual(FeedbackStatus.Completed);

      await expectFeedbackNotification(
        feedback.id,
        NotificationType.FeedbackResolved,
      );
    });

    it('should not create duplicate notification if status is already Completed', async () => {
      await createFeedback({ status: FeedbackStatus.Completed });
      const payload = {
        action: 'update',
        type: 'Issue',
        data: { id: 'linear-issue-123', state: { id: 's1', name: 'Done' } },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      // Verify no notification was created
      const notifications = await con.getRepository(NotificationV2).find({
        where: { type: NotificationType.FeedbackResolved },
      });
      expect(notifications).toHaveLength(0);
    });

    it('should not create duplicate notification if status is already Cancelled', async () => {
      await createFeedback({ status: FeedbackStatus.Cancelled });
      const payload = {
        action: 'update',
        type: 'Issue',
        data: {
          id: 'linear-issue-123',
          state: { id: 's1', name: 'Canceled' },
        },
        updatedFrom: { stateId: 'old-state' },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const notifications = await con.getRepository(NotificationV2).find({
        where: { type: NotificationType.FeedbackCancelled },
      });
      expect(notifications).toHaveLength(0);
    });
  });

  describe('reply handling', () => {
    it('should create feedback reply and send email for @reply comment', async () => {
      const feedback = await createFeedback();
      const payload = {
        action: 'create',
        type: 'Comment',
        data: {
          id: 'comment-123',
          body: '@reply Thanks for reporting this issue.',
          issue: { id: 'linear-issue-123' },
          user: { name: 'Chris', email: 'chris@daily.dev' },
        },
      };

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const replies = await con.getRepository(FeedbackReply).find({
        where: { feedbackId: feedback.id },
      });
      expect(replies).toHaveLength(1);
      expect(replies[0]).toMatchObject({
        feedbackId: feedback.id,
        body: 'Thanks for reporting this issue.',
        authorName: 'Chris',
        authorEmail: 'chris@daily.dev',
      });

      expect(mailing.sendEmail).toHaveBeenCalledTimes(1);
      expect(mailing.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: usersFixture[0].email,
          reply_to: 'chris@daily.dev',
          identifiers: { id: feedback.userId },
        }),
      );

      const notifications = await con
        .getRepository(NotificationV2)
        .findBy({ referenceId: feedback.id });
      expect(notifications).toHaveLength(0);
    });

    it('should fallback reply_to to support email when author email is missing', async () => {
      await createFeedback();
      const payload = {
        action: 'create',
        type: 'Comment',
        data: {
          id: 'comment-123',
          body: '@reply We shipped the fix.',
          issue: { id: 'linear-issue-123' },
          user: { name: 'Chris' },
        },
      };

      await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(mailing.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to: 'support@daily.dev',
        }),
      );
    });

    it('should create reply when author email is invalid and fallback to support reply_to', async () => {
      const feedback = await createFeedback();
      const payload = {
        action: 'create',
        type: 'Comment',
        data: {
          id: 'comment-123',
          body: '@reply Shared an update for this',
          issue: { id: 'linear-issue-123' },
          user: { name: 'Chris', email: 'invalid-email' },
        },
      };

      await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      const replies = await con.getRepository(FeedbackReply).findBy({
        feedbackId: feedback.id,
      });
      expect(replies).toHaveLength(1);
      expect(replies[0].authorEmail).toBeNull();
      expect(mailing.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to: 'support@daily.dev',
        }),
      );
    });
  });

  describe('idempotency', () => {
    it('should not update if status is already the same', async () => {
      await createFeedback({ status: FeedbackStatus.Completed });
      const payload = {
        action: 'update',
        type: 'Issue',
        data: {
          id: 'linear-issue-123',
          state: { id: 's1', name: 'Done' },
        },
        updatedFrom: { stateId: 'old-state' },
      };

      const feedbackBefore = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      const updatedAtBefore = feedbackBefore?.updatedAt;

      // Wait a bit to ensure timestamp would be different
      await new Promise((resolve) => setTimeout(resolve, 10));

      const { body } = await request(app.server)
        .post('/webhooks/linear')
        .send(payload)
        .use((req) => withLinearSignature(req, payload))
        .expect(200);

      expect(body.success).toEqual(true);

      const feedbackAfter = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(feedbackAfter?.updatedAt.getTime()).toEqual(
        updatedAtBefore?.getTime(),
      );
    });
  });
});
