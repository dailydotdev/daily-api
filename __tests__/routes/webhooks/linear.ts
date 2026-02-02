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
  });

  describe('status mapping', () => {
    it('should update status to Accepted when state is "In Progress"', async () => {
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
      expect(feedback?.status).toEqual(FeedbackStatus.Accepted);
    });

    it('should update status to Cancelled when state is "Canceled"', async () => {
      await createFeedback();
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

      const feedback = await con
        .getRepository(Feedback)
        .findOneBy({ linearIssueId: 'linear-issue-123' });
      expect(feedback?.status).toEqual(FeedbackStatus.Cancelled);
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

      // Verify notification was created
      const notification = await con.getRepository(NotificationV2).findOne({
        where: {
          type: NotificationType.FeedbackResolved,
          referenceId: feedback.id,
        },
      });
      expect(notification).toBeTruthy();
      expect(notification?.referenceType).toEqual('feedback');

      // Verify user notification was created
      const userNotification = await con
        .getRepository(UserNotification)
        .findOne({
          where: {
            userId: '1',
            notificationId: notification!.id,
          },
        });
      expect(userNotification).toBeTruthy();
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
  });

  describe('idempotency', () => {
    it('should not update if status is already the same', async () => {
      await createFeedback({ status: FeedbackStatus.Accepted });
      const payload = {
        action: 'update',
        type: 'Issue',
        data: {
          id: 'linear-issue-123',
          state: { id: 's1', name: 'In Progress' },
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
