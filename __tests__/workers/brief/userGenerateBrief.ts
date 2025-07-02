import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { userGenerateBriefWorker as worker } from '../../../src/workers/brief/userGenerateBrief';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Source, User } from '../../../src/entity';

import { usersFixture } from '../../fixture/user';
import { typedWorkers } from '../../../src/workers';
import { BriefingModel, BriefingType } from '../../../src/integrations/feed';
import { BriefPost } from '../../../src/entity/posts/BriefPost';
import { sourcesFixture } from '../../fixture';
import { generateShortId } from '../../../src/ids';
import nock from 'nock';
import { UserBriefingRequest } from '@dailydotdev/schema';
import { triggerTypedEvent } from '../../../src/common';

jest.mock('../../../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../../../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userGenerateBrief worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should skip if post not found', async () => {
    await expectSuccessfulTypedBackground(worker, {
      payload: new UserBriefingRequest({
        userId: '1',
        frequency: BriefingType.Daily,
        modelName: 'default',
      }),
      postId: 'not-exist-brief-id',
    });
  });

  it('should generate brief', async () => {
    const postId = await generateShortId();

    const post = con.getRepository(BriefPost).create({
      id: postId,
      shortId: postId,
      authorId: '1',
      private: true,
      visible: false,
    });

    await con.getRepository(BriefPost).save(post);

    nock('http://api')
      .post('/api/user/briefing')
      .reply(200, {
        sections: [
          {
            title: 'Must know',
            items: [
              {
                title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                body: 'OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.',
              },
            ],
          },
          {
            title: 'Good to know',
            items: [
              {
                title: 'AI agents are still pretty dumb, and dangerous',
                body: "Salesforce's CRMArena-Pro benchmark found AI agents only 58% successful on single tasks and 35% on multi-step CRM tasks, often mishandling sensitive data due to poor confidentiality awareness.",
              },
              {
                title: 'Threads gets Fediverse feed',
                body: "Meta's Threads now offers a dedicated opt-in feed for ActivityPub content and improved profile search for Fediverse users, marking its most prominent integration with the open social web to date.",
              },
            ],
          },
        ],
      });

    await expectSuccessfulTypedBackground(worker, {
      payload: new UserBriefingRequest({
        userId: '1',
        frequency: BriefingType.Daily,
        modelName: BriefingModel.Default,
      }),
      postId,
    });

    const briefPost = await con.getRepository(BriefPost).findOne({
      where: {
        id: postId,
      },
    });

    expect(briefPost).toBeDefined();
    expect(briefPost!.visible).toBe(true);
    expect(briefPost!.content).toBe(`## Must know

- **OpenAI gets a DoD contract, Microsoft gets salty**: OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.

## Good to know

- **AI agents are still pretty dumb, and dangerous**: Salesforce's CRMArena-Pro benchmark found AI agents only 58% successful on single tasks and 35% on multi-step CRM tasks, often mishandling sensitive data due to poor confidentiality awareness.
- **Threads gets Fediverse feed**: Meta's Threads now offers a dedicated opt-in feed for ActivityPub content and improved profile search for Fediverse users, marking its most prominent integration with the open social web to date.`);

    expect(triggerTypedEvent).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.brief-ready',
      {
        payload: new UserBriefingRequest({
          userId: '1',
          frequency: BriefingType.Daily,
          modelName: BriefingModel.Default,
        }),
        postId,
      },
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });
});
