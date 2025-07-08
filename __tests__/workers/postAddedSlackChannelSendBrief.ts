import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { postAddedSlackChannelSendBriefWorker as worker } from '../../src/workers/postAddedSlackChannelSendBrief';
import {
  ArticlePost,
  BRIEFING_SOURCE,
  PostType,
  Source,
  UNKNOWN_SOURCE,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';
import { usersFixture } from '../fixture/user';
import {
  UserIntegration,
  UserIntegrationType,
} from '../../src/entity/UserIntegration';
import { encrypt } from '../../src/common/crypto';
import { UserSourceIntegrationSlack } from '../../src/entity/UserSourceIntegration';
import { ChangeObject } from '../../src/types';
import { SlackApiErrorCode } from '../../src/errors';
import { BriefPost } from '../../src/entity/posts/BriefPost';
import { updateFlagsStatement } from '../../src/common';

const conversationsJoin = jest.fn().mockResolvedValue({
  ok: true,
});

const chatPostMessage = jest.fn().mockResolvedValue({
  ok: true,
});

jest.mock('@slack/web-api', () => ({
  ...(jest.requireActual('@slack/web-api') as Record<string, unknown>),
  WebClient: function () {
    return {
      conversations: {
        join: conversationsJoin,
      },
      chat: {
        postMessage: chatPostMessage,
      },
    };
  },
}));

let con: DataSource;

beforeAll(async () => {
  jest.clearAllMocks();
  con = await createOrGetConnection();
});

describe('postAddedSlackChannelSendBrief worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    await saveFixtures(con, User, usersFixture);
    await con.getRepository(BriefPost).save({
      ...postsFixture[0],
      id: `bsp-${postsFixture[0].id}`,
      shortId: `bsp-${postsFixture[0].shortId}`,
      type: PostType.Brief,
      sourceId: BRIEFING_SOURCE,
      authorId: '1',
    });
    const [userIntegration, userIntegration2] = await con
      .getRepository(UserIntegration)
      .save([
        {
          userId: '1',
          type: UserIntegrationType.Slack,
          name: 'daily.dev',
          meta: {
            appId: 'sapp1',
            scope: 'channels:read,chat:write,channels:join',
            teamId: 'st1',
            teamName: 'daily.dev',
            tokenType: 'bot',
            accessToken: await encrypt(
              'xoxb-token',
              process.env.SLACK_DB_KEY as string,
            ),
            slackUserId: 'su1',
          },
        },
        {
          userId: '2',
          type: UserIntegrationType.Slack,
          name: 'daily.dev',
          meta: {
            appId: 'sapp2',
            scope: 'channels:read,chat:write,channels:join',
            teamId: 'st2',
            teamName: 'daily.dev',
            tokenType: 'bot',
            accessToken: await encrypt(
              'xoxb-token2',
              process.env.SLACK_DB_KEY as string,
            ),
            slackUserId: 'su2',
          },
        },
      ]);
    await con.getRepository(UserSourceIntegrationSlack).save([
      {
        userIntegrationId: userIntegration.id,
        sourceId: BRIEFING_SOURCE,
        channelIds: ['1'],
      },
      {
        userIntegrationId: userIntegration2.id,
        sourceId: BRIEFING_SOURCE,
        channelIds: ['3'],
      },
    ]);
    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      type: UserPersonalizedDigestType.Brief,
      flags: {
        sendType: UserPersonalizedDigestSendType.daily,
        slack: true,
      },
    });
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send a message to the slack channel', async () => {
    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(1);
    expect(chatPostMessage).toHaveBeenCalledTimes(1);

    expect(conversationsJoin).toHaveBeenCalledWith({
      channel: '1',
    });
    expect(chatPostMessage).toHaveBeenCalledWith({
      channel: '1',
      attachments: [
        {
          author_icon: 'http//image.com/briefing',
          author_name: 'Presidential briefing | daily.dev',
          title: 'P1',
          title_link:
            'http://localhost:5002/posts/p1-bsp-p1?utm_source=notification&utm_medium=slack&utm_campaign=new_post',
        },
      ],
      text: '<http://localhost:5002/posts/p1-bsp-p1?utm_source=notification&utm_medium=slack&utm_campaign=new_post|http://localhost:5002/posts/p1-bsp-p1>',
      unfurl_links: false,
    });
  });

  it('should not send a message to the slack channel if the post source has no slack integrations', async () => {
    await con.getRepository(UserSourceIntegrationSlack).clear();

    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });

  it('should ignore if post type is not brief', async () => {
    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
        type: PostType.Article,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });

  it('should ignore if post source is not brief', async () => {
    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
        sourceId: UNKNOWN_SOURCE,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });

  it('should send a message to the private slack channel', async () => {
    conversationsJoin.mockRejectedValueOnce({
      message: 'An API error occurred',
      code: 'slack_webapi_platform_error',
      data: {
        ok: false,
        error: SlackApiErrorCode.MethodNotSupportedForChannelType,
      },
    });

    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(1);
    expect(chatPostMessage).toHaveBeenCalledTimes(1);

    expect(conversationsJoin).toHaveBeenCalledWith({
      channel: '1',
    });
    expect(chatPostMessage).toHaveBeenCalledWith({
      channel: '1',
      attachments: [
        {
          author_icon: 'http//image.com/briefing',
          author_name: 'Presidential briefing | daily.dev',
          title: 'P1',
          title_link:
            'http://localhost:5002/posts/p1-bsp-p1?utm_source=notification&utm_medium=slack&utm_campaign=new_post',
        },
      ],
      text: '<http://localhost:5002/posts/p1-bsp-p1?utm_source=notification&utm_medium=slack&utm_campaign=new_post|http://localhost:5002/posts/p1-bsp-p1>',
      unfurl_links: false,
    });
  });

  it('should ignore if post author is missing', async () => {
    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
        authorId: null,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });

  it('should ignore if digest subscription is missing', async () => {
    await con.getRepository(UserPersonalizedDigest).delete({
      userId: '1',
      type: UserPersonalizedDigestType.Brief,
    });

    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
        authorId: null,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });

  it('should ignore if digest slack flag is not true', async () => {
    await con.getRepository(UserPersonalizedDigest).update(
      {
        userId: '1',
        type: UserPersonalizedDigestType.Brief,
      },
      {
        flags: updateFlagsStatement<UserPersonalizedDigest>({
          slack: false,
        }),
      },
    );

    const post = await con.getRepository(BriefPost).findOneByOrFail({
      id: 'bsp-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
        authorId: null,
      } as unknown as ChangeObject<BriefPost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });

  describe('vordr', () => {
    it('should not send a message to the slack channel when the post is prevented by vordr', async () => {
      const post = await con.getRepository(BriefPost).findOneByOrFail({
        id: 'bsp-p1',
      });

      await con.getRepository(BriefPost).update(
        { id: post.id },
        {
          flags: updateFlagsStatement<BriefPost>({
            vordr: true,
          }),
        },
      );

      await expectSuccessfulTypedBackground(worker, {
        post: {
          ...post,
        } as unknown as ChangeObject<BriefPost>,
      });

      expect(conversationsJoin).toHaveBeenCalledTimes(0);
      expect(chatPostMessage).toHaveBeenCalledTimes(0);
    });
  });
});
