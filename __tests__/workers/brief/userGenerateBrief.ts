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
      userId: '1',
      postId: 'not-exist-brief-id',
      frequency: BriefingType.Daily,
      modelName: 'default',
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
            ],
          },
        ],
      });

    await expectSuccessfulTypedBackground(worker, {
      userId: '1',
      postId,
      frequency: BriefingType.Daily,
      modelName: BriefingModel.Default,
    });

    const briefPost = await con.getRepository(BriefPost).findOne({
      where: {
        id: postId,
      },
    });

    expect(briefPost).toBeDefined();
    expect(briefPost!.visible).toBe(true);
    expect(briefPost!.content).toBe(`## Must know

### OpenAI gets a DoD contract, Microsoft gets salty

OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.

## Good to know

### AI agents are still pretty dumb, and dangerous

Salesforce's CRMArena-Pro benchmark found AI agents only 58% successful on single tasks and 35% on multi-step CRM tasks, often mishandling sensitive data due to poor confidentiality awareness.`);
  });
});
