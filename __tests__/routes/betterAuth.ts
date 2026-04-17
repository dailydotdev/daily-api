import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { DataSource } from 'typeorm';
import type { Pool } from 'pg';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { User } from '../../src/entity/user/User';
import { DeletedUser } from '../../src/entity/user/DeletedUser';
import { Source } from '../../src/entity/Source';
import { sourcesFixture } from '../fixture/source';
import { Feed } from '../../src/entity/Feed';
import { UserAction, UserActionType } from '../../src/entity/user/UserAction';
import { DigestPost } from '../../src/entity/posts/DigestPost';
import { DIGEST_SOURCE } from '../../src/entity/Source';
import {
  ClaimableItem,
  ClaimableItemTypes,
} from '../../src/entity/ClaimableItem';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { OpportunityUser } from '../../src/entity/opportunities/user';
import { OpportunityUserType } from '../../src/entity/opportunities/types';
import { OpportunityState } from '@dailydotdev/schema';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPreferenceStatus,
  NotificationType,
} from '../../src/notifications/common';
import { generateShortId } from '../../src/ids';
import { usersFixture } from '../fixture';
import { ioRedisPool } from '../../src/redis';
import * as betterAuthModule from '../../src/betterAuth';

jest.mock('../../src/common/paddle/index.ts', () => ({
  ...(jest.requireActual('../../src/common/paddle/index.ts') as Record<
    string,
    unknown
  >),
  paddleInstance: {
    subscriptions: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../../src/cio', () => ({
  ...(jest.requireActual('../../src/cio') as Record<string, unknown>),
  identifyAnonymousFunnelSubscription: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('better-auth/api', () => ({
  ...(jest.requireActual('better-auth/api') as Record<string, unknown>),
  getOAuthState: jest.fn().mockResolvedValue(null),
}));

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();

  process.env.BETTER_AUTH_SECRET = 'a]3Bv!k9Pz@mQ7wX#rL2sY&dN5fH8jT-test-only';
  try {
    const { initializeBetterAuth } = await import('../../src/betterAuth');
    initializeBetterAuth();
  } catch {
    // BA initialization may fail in test with mocked module
  }

  const appFunc = (await import('../../src')).default;
  app = await appFunc();
  return app.ready();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  await ioRedisPool.execute((client) => client.flushall());
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
});

describe('betterAuth routes', () => {
  describe('native Better Auth routes', () => {
    it('should return 200 for the health endpoint', async () => {
      const res = await request(app.server).get('/auth/ok');

      expect(res.status).toBe(200);
    });

    it('should keep OAuth state in the database with a 10 minute state cookie', async () => {
      const { getBetterAuthOptions } = await import('../../src/betterAuth');
      const options = getBetterAuthOptions(
        (con.driver as unknown as { master: never }).master,
      );

      expect(options.advanced?.cookies?.state).toMatchObject({
        attributes: {
          maxAge: 10 * 60,
        },
      });
      expect(options.account).toMatchObject({
        modelName: 'ba_account',
      });
      expect(options.session).toMatchObject({
        modelName: 'ba_session',
        storeSessionInDatabase: true,
        expiresIn: 30 * 24 * 60 * 60,
        updateAge: 12 * 60 * 60,
      });
    });

    describe('user.create.before hook', () => {
      const getBeforeHook = async () => {
        const { getBetterAuthOptions } = await import('../../src/betterAuth');
        const options = getBetterAuthOptions(
          (con.driver as unknown as { master: Pool }).master,
        );
        const before = options.databaseHooks?.user?.create?.before;
        if (!before) {
          throw new Error('before hook not configured');
        }
        return before;
      };

      it('should regenerate id when tracking cookie matches a deleted user', async () => {
        const before = await getBeforeHook();
        const deletedUserId = 'aBcDeFgHiJkLmNoPqRsTu';
        await con.getRepository(DeletedUser).save({ id: deletedUserId });

        const result = await before(
          {
            email: 'new-signup@example.com',
            name: 'New Signup',
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            request: new Request('http://localhost/auth/sign-up/email', {
              headers: { cookie: `da2=${deletedUserId}` },
            }),
            body: {},
          },
        );

        const assignedId = (result as { data: { id: string } }).data.id;
        expect(assignedId).not.toEqual(deletedUserId);

        const stillDeleted = await con
          .getRepository(DeletedUser)
          .findOneBy({ id: deletedUserId });
        expect(stillDeleted).not.toBeNull();
      });
    });

    describe('user.create.after hook', () => {
      const getAfterHook = async () => {
        const { getBetterAuthOptions } = await import('../../src/betterAuth');
        const options = getBetterAuthOptions(
          (con.driver as unknown as { master: Pool }).master,
        );
        const after = options.databaseHooks?.user?.create?.after;
        if (!after) {
          throw new Error('after hook not configured');
        }
        return after;
      };

      const makeContext = (
        overrides: {
          body?: Record<string, unknown>;
          cookie?: string;
        } = {},
      ) => ({
        request: new Request('http://localhost/auth/sign-up/email', {
          headers: overrides.cookie ? { cookie: overrides.cookie } : undefined,
        }),
        body: overrides.body,
      });

      const createBaseUser = async () => {
        const id = await generateShortId();
        const email = `hook-${id}@test.com`;
        await con.getRepository(User).save({
          id,
          name: 'Hook User',
          email,
          username: `u_${id}`,
          image: 'https://daily.dev/fake.jpg',
          createdAt: new Date(),
        });
        return { id, email };
      };

      it('should add feed with id equal to user id', async () => {
        const after = await getAfterHook();
        const user = await createBaseUser();

        await after(user, makeContext());

        const feed = await con.getRepository(Feed).findOneBy({ id: user.id });
        expect(feed).not.toBeNull();
        expect(feed!.id).toEqual(user.id);
        expect(feed!.userId).toEqual(user.id);
      });

      it('should create a DigestPost stub', async () => {
        const after = await getAfterHook();
        const user = await createBaseUser();

        await after(user, makeContext());

        const digestPost = await con
          .getRepository(DigestPost)
          .findOneBy({ authorId: user.id });
        expect(digestPost).not.toBeNull();
        expect(digestPost!.sourceId).toBe(DIGEST_SOURCE);
        expect(digestPost!.visible).toBeFalsy();
        expect(digestPost!.private).toBeTruthy();
      });

      it('should set UserAction for cores role', async () => {
        const after = await getAfterHook();
        const user = await createBaseUser();

        await after(user, makeContext());

        const userAction = await con.getRepository(UserAction).findOneBy({
          userId: user.id,
          type: UserActionType.CheckedCoresRole,
        });
        expect(userAction).not.toBeNull();
      });

      it('should mute marketing notifications when acceptedMarketing is false', async () => {
        const after = await getAfterHook();
        const user = await createBaseUser();

        await after(user, makeContext({ body: { acceptedMarketing: false } }));

        const persisted = await con
          .getRepository(User)
          .findOneBy({ id: user.id });
        expect(
          persisted!.notificationFlags?.[NotificationType.Marketing],
        ).toEqual({
          email: NotificationPreferenceStatus.Muted,
          inApp: NotificationPreferenceStatus.Muted,
        });
      });

      it('should use default notification flags when acceptedMarketing is true', async () => {
        const after = await getAfterHook();
        const user = await createBaseUser();

        await after(user, makeContext({ body: { acceptedMarketing: true } }));

        const persisted = await con
          .getRepository(User)
          .findOneBy({ id: user.id });
        expect(persisted!.notificationFlags).toEqual(
          DEFAULT_NOTIFICATION_SETTINGS,
        );
      });

      it('should claim opportunities that user created as anonymous', async () => {
        const after = await getAfterHook();
        const user = await createBaseUser();

        const opportunity = await con.getRepository(OpportunityJob).save(
          con.getRepository(OpportunityJob).create({
            title: 'Test',
            tldr: 'Test',
            state: OpportunityState.DRAFT,
          }),
        );

        await con.getRepository(ClaimableItem).save({
          identifier: user.id,
          type: ClaimableItemTypes.Opportunity,
          flags: {
            opportunityId: opportunity.id,
          },
        });

        await after(user, makeContext());

        const updatedClaimableItem = await con
          .getRepository(ClaimableItem)
          .findOneBy({
            identifier: user.id,
            type: ClaimableItemTypes.Opportunity,
          });
        expect(updatedClaimableItem).not.toBeNull();
        expect(updatedClaimableItem!.claimedAt).toBeInstanceOf(Date);
        expect(updatedClaimableItem!.claimedById).toBe(user.id);

        const opportunityUser = await con
          .getRepository(OpportunityUser)
          .findOneBy({
            opportunityId: opportunity.id,
            userId: user.id,
          });
        expect(opportunityUser).toEqual({
          opportunityId: opportunity.id,
          userId: user.id,
          type: OpportunityUserType.Recruiter,
        });
      });

      it('should claim opportunities that user created with email', async () => {
        const after = await getAfterHook();
        const user = await createBaseUser();

        const opportunity = await con.getRepository(OpportunityJob).save(
          con.getRepository(OpportunityJob).create({
            title: 'Test',
            tldr: 'Test',
            state: OpportunityState.DRAFT,
          }),
        );

        await con.getRepository(ClaimableItem).save({
          identifier: user.email,
          type: ClaimableItemTypes.Opportunity,
          flags: {
            opportunityId: opportunity.id,
          },
        });

        await after(user, makeContext());

        const updatedClaimableItem = await con
          .getRepository(ClaimableItem)
          .findOneBy({
            identifier: user.email,
            type: ClaimableItemTypes.Opportunity,
          });
        expect(updatedClaimableItem).not.toBeNull();
        expect(updatedClaimableItem!.claimedAt).toBeInstanceOf(Date);
        expect(updatedClaimableItem!.claimedById).toBe(user.id);

        const opportunityUser = await con
          .getRepository(OpportunityUser)
          .findOneBy({
            opportunityId: opportunity.id,
            userId: user.id,
          });
        expect(opportunityUser).toEqual({
          opportunityId: opportunity.id,
          userId: user.id,
          type: OpportunityUserType.Recruiter,
        });
      });
    });

    it('should forward native callback routes to BetterAuth handler', async () => {
      const getBetterAuthSpy = jest
        .spyOn(betterAuthModule, 'getBetterAuth')
        .mockReturnValue({
          handler: async (req: Request) => {
            const url = new URL(req.url);
            return new Response(`${url.pathname}${url.search}`, {
              status: 200,
            });
          },
          api: {
            getSession: async () => null,
            setPassword: async () => ({ status: true }),
          },
        } as ReturnType<typeof betterAuthModule.getBetterAuth>);

      const res = await request(app.server).get(
        '/auth/callback/google?state=test&code=abc',
      );

      expect(res.status).toBe(200);
      expect(res.text).toBe('/auth/callback/google?state=test&code=abc');

      getBetterAuthSpy.mockRestore();
    });
  });
});
