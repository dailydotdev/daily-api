import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { postAddedSlackChannelSendWorker as worker } from '../../src/workers/postAddedSlackChannelSend';
import { ArticlePost, Source, User } from '../../src/entity';
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

describe('postAddedSlackChannelSend worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    await saveFixtures(con, User, usersFixture);
    const [userIntegration] = await con.getRepository(UserIntegration).save([
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
    ]);
    await con.getRepository(UserSourceIntegrationSlack).save([
      {
        userIntegrationId: userIntegration.id,
        sourceId: 'a',
        channelIds: ['1'],
      },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send a message to the slack channel', async () => {
    const post = await con.getRepository(ArticlePost).findOneByOrFail({
      id: 'p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: post as unknown as ChangeObject<ArticlePost>,
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
          author_icon: 'https://app.daily.dev/apple-touch-icon.png',
          author_name: 'daily.dev',
          image_url: 'https://daily.dev/image.jpg',
          title: 'P1',
          title_link: 'http://localhost:5002/posts/p1',
        },
      ],
      text: 'New post on "A" source. http://localhost:5002/posts/p1',
    });
  });

  it('should not send a message to the slack channel if the post source has no slack integrations', async () => {
    await con.getRepository(UserSourceIntegrationSlack).delete({});

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });

  it('should ignore if post or source do not exist', async () => {
    const post = await con.getRepository(ArticlePost).findOneByOrFail({
      id: 'p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      post: {
        ...post,
        id: 'doesnotexistpost',
      } as unknown as ChangeObject<ArticlePost>,
    });

    expect(conversationsJoin).toHaveBeenCalledTimes(0);
    expect(chatPostMessage).toHaveBeenCalledTimes(0);
  });
});
