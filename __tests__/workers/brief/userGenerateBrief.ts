import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { userGenerateBriefWorker as worker } from '../../../src/workers/brief/userGenerateBrief';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  BRIEFING_SOURCE,
  Feed,
  Keyword,
  Source,
  User,
  UserAction,
  UserActionType,
} from '../../../src/entity';

import { usersFixture } from '../../fixture/user';
import { typedWorkers } from '../../../src/workers';
import { BriefingModel, BriefingType } from '../../../src/integrations/feed';
import { BriefPost } from '../../../src/entity/posts/BriefPost';
import { sourcesFixture } from '../../fixture';
import { generateShortId } from '../../../src/ids';
import nock from 'nock';
import { UserBriefingRequest } from '@dailydotdev/schema';
import { triggerTypedEvent } from '../../../src/common';
import { keywordsFixture } from '../../fixture/keywords';
import { ContentPreferenceKeyword } from '../../../src/entity/contentPreference/ContentPreferenceKeyword';
import { ContentPreferenceStatus } from '../../../src/entity/contentPreference/types';

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

    await saveFixtures(con, Keyword, keywordsFixture);

    await con.getRepository(User).save([
      {
        ...usersFixture[0],
        github: undefined,
        id: `ugbw-${usersFixture[0].id}`,
        username: `ugbw-${usersFixture[0].username}`,
        experienceLevel: 'NOT_ENGINEER',
      },
      {
        ...usersFixture[1],
        github: undefined,
        id: `ugbw-${usersFixture[1].id}`,
        username: `ugbw-${usersFixture[1].username}`,
        experienceLevel: 'NOT_ENGINEER',
      },
    ]);
    await con.getRepository(Feed).save({
      id: `ugbw-${usersFixture[0].id}`,
      userId: `ugbw-${usersFixture[0].id}`,
    });

    await con.getRepository(ContentPreferenceKeyword).save([
      {
        referenceId: 'webdev',
        userId: `ugbw-${usersFixture[0].id}`,
        feedId: `ugbw-${usersFixture[0].id}`,
        keywordId: 'webdev',
        status: ContentPreferenceStatus.Follow,
      },
      {
        referenceId: 'development',
        userId: `ugbw-${usersFixture[0].id}`,
        feedId: `ugbw-${usersFixture[0].id}`,
        keywordId: 'development',
        status: ContentPreferenceStatus.Subscribed,
      },
      {
        referenceId: 'fullstack',
        userId: `ugbw-${usersFixture[0].id}`,
        feedId: `ugbw-${usersFixture[0].id}`,
        keywordId: 'fullstack',
        status: ContentPreferenceStatus.Blocked,
      },
    ]);
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
        userId: 'ugbw-1',
        frequency: BriefingType.Daily,
        modelName: BriefingModel.Default,
      }),
      postId: 'not-exist-brief-id',
    });
  });

  it('should generate brief', async () => {
    const postId = await generateShortId();

    const post = con.getRepository(BriefPost).create({
      id: postId,
      shortId: postId,
      authorId: 'ugbw-1',
      private: true,
      visible: false,
    });

    await con.getRepository(BriefPost).save(post);

    let requestBody = null;

    nock('http://api')
      .post('/api/user/briefing', (body) => {
        requestBody = body;

        return true;
      })
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
        userId: 'ugbw-1',
        frequency: BriefingType.Daily,
        modelName: BriefingModel.Default,
      }),
      postId,
    });

    expect(requestBody).toEqual({
      user_id: 'ugbw-1',
      frequency: BriefingType.Daily,
      model_name: BriefingModel.Default,
      allowed_tags: ['webdev', 'development'],
      seniority_level: 'NOT_ENGINEER',
    });

    const briefPost = await con.getRepository(BriefPost).findOne({
      where: {
        id: postId,
      },
    });

    expect(briefPost).toBeDefined();
    expect(briefPost!.private).toBe(false);
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
          userId: 'ugbw-1',
          frequency: BriefingType.Daily,
          modelName: BriefingModel.Default,
          allowedTags: ['webdev', 'development'],
          seniorityLevel: 'NOT_ENGINEER',
        }),
        postId,
      },
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });

  it('should set generated brief action', async () => {
    const postId = await generateShortId();

    const post = con.getRepository(BriefPost).create({
      id: postId,
      shortId: postId,
      authorId: 'ugbw-1',
      private: true,
      visible: false,
    });

    await con.getRepository(BriefPost).save(post);

    const actionBefore = await con.getRepository(UserAction).findOne({
      where: {
        userId: 'ugbw-1',
        type: UserActionType.GeneratedBrief,
      },
    });

    expect(actionBefore).toBeNull();

    nock('http://api').post('/api/user/briefing').reply(200, {
      sections: [],
    });

    await expectSuccessfulTypedBackground(worker, {
      payload: new UserBriefingRequest({
        userId: 'ugbw-1',
        frequency: BriefingType.Daily,
        modelName: BriefingModel.Default,
        allowedTags: ['webdev', 'development'],
        seniorityLevel: 'NOT_ENGINEER',
      }),
      postId,
    });

    const action = await con.getRepository(UserAction).findOne({
      where: {
        userId: 'ugbw-1',
        type: UserActionType.GeneratedBrief,
      },
    });

    expect(action).toBeTruthy();
  });

  it('should send last generated brief with brief request', async () => {
    const postId = await generateShortId();
    const lastPostId = await generateShortId();
    const otherPostId = await generateShortId();

    await con.getRepository(BriefPost).save([
      con.getRepository(BriefPost).create({
        id: postId,
        shortId: postId,
        authorId: 'ugbw-1',
        private: true,
        visible: false,
        createdAt: new Date(Date.now()),
        sourceId: BRIEFING_SOURCE,
      }),
      con.getRepository(BriefPost).create({
        id: lastPostId,
        shortId: lastPostId,
        authorId: 'ugbw-1',
        private: true,
        visible: true,
        contentJSON: [
          {
            title: 'Must know',
            items: [
              {
                title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                body: 'OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.',
              },
            ],
          },
        ],
        flags: {
          posts: 3,
          sources: 2,
          savedTime: 40,
        },
        readTime: 5,
        collectionSources: ['a', 'b'],
        createdAt: new Date(Date.now() - 1000),
        sourceId: BRIEFING_SOURCE,
      }),
      con.getRepository(BriefPost).create({
        id: otherPostId,
        shortId: otherPostId,
        authorId: 'ugbw-1',
        private: true,
        visible: true,
        contentJSON: [],
        flags: {
          posts: 3,
          sources: 2,
          savedTime: 40,
        },
        readTime: 5,
        collectionSources: ['a', 'b'],
        createdAt: new Date(Date.now() - 2000),
        sourceId: BRIEFING_SOURCE,
      }),
    ]);

    let requestBody = null;

    nock('http://api')
      .post('/api/user/briefing', (body) => {
        requestBody = body;

        return true;
      })
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
        ],
      });

    await expectSuccessfulTypedBackground(worker, {
      payload: new UserBriefingRequest({
        userId: 'ugbw-1',
        frequency: BriefingType.Daily,
        modelName: BriefingModel.Default,
      }),
      postId,
    });

    expect(requestBody).toEqual({
      user_id: 'ugbw-1',
      frequency: BriefingType.Daily,
      model_name: BriefingModel.Default,
      allowed_tags: ['webdev', 'development'],
      seniority_level: 'NOT_ENGINEER',
      recent_briefing: {
        sections: [
          {
            title: 'Must know',
            items: [
              {
                title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                body: 'OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.',
                postIds: [],
              },
            ],
          },
        ],
        brief_statistics: {
          posts: 3,
          sources: 2,
          saved_time: 40 * 60,
        },
        reading_time: 5 * 60,
        source_ids: ['a', 'b'],
      },
    });

    const briefPost = await con.getRepository(BriefPost).findOne({
      where: {
        id: postId,
      },
    });

    expect(briefPost).toBeDefined();
    expect(briefPost!.visible).toBe(true);
    expect(briefPost!.content).toBe(`## Must know

- **OpenAI gets a DoD contract, Microsoft gets salty**: OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.`);

    expect(triggerTypedEvent).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.brief-ready',
      {
        payload: new UserBriefingRequest({
          userId: 'ugbw-1',
          frequency: BriefingType.Daily,
          modelName: BriefingModel.Default,
          allowedTags: ['webdev', 'development'],
          seniorityLevel: 'NOT_ENGINEER',
          recentBriefing: {
            sections: [
              {
                title: 'Must know',
                items: [
                  {
                    title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                    body: `OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.`,
                  },
                ],
              },
            ],
            briefStatistics: {
              posts: 3,
              sources: 2,
              savedTime: 40 * 60,
            },
            readingTime: 5 * 60,
            sourceIds: ['a', 'b'],
          },
        }),
        postId,
      },
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });

  it('should send last generated brief from the same user', async () => {
    const postId = await generateShortId();
    const lastPostId = await generateShortId();
    const otherPostId = await generateShortId();

    await con.getRepository(BriefPost).save([
      con.getRepository(BriefPost).create({
        id: postId,
        shortId: postId,
        authorId: 'ugbw-1',
        private: true,
        visible: false,
        createdAt: new Date(Date.now()),
        sourceId: BRIEFING_SOURCE,
      }),
      con.getRepository(BriefPost).create({
        id: lastPostId,
        shortId: lastPostId,
        authorId: 'ugbw-2',
        private: true,
        visible: true,
        contentJSON: [
          {
            title: 'Must know',
            items: [
              {
                title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                body: "OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI's previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.",
              },
            ],
          },
        ],
        flags: {
          posts: 3,
          sources: 2,
          savedTime: 40,
        },
        readTime: 5,
        collectionSources: ['a', 'b'],
        createdAt: new Date(Date.now() - 1000),
        sourceId: BRIEFING_SOURCE,
      }),
      con.getRepository(BriefPost).create({
        id: otherPostId,
        shortId: otherPostId,
        authorId: 'ugbw-1',
        private: true,
        visible: true,
        contentJSON: [
          {
            title: 'Hard to know',
            items: [
              {
                title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                body: "OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI's previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.",
              },
            ],
          },
        ],
        flags: {
          posts: 3,
          sources: 2,
          savedTime: 40,
        },
        readTime: 5,
        collectionSources: ['a', 'b'],
        createdAt: new Date(Date.now() - 2000),
        sourceId: BRIEFING_SOURCE,
      }),
    ]);

    let requestBody = null;

    nock('http://api')
      .post('/api/user/briefing', (body) => {
        requestBody = body;

        return true;
      })
      .reply(200, {
        sections: [],
      });

    await expectSuccessfulTypedBackground(worker, {
      payload: new UserBriefingRequest({
        userId: 'ugbw-1',
        frequency: BriefingType.Daily,
        modelName: BriefingModel.Default,
      }),
      postId,
    });

    expect(requestBody).toEqual({
      user_id: 'ugbw-1',
      frequency: BriefingType.Daily,
      model_name: BriefingModel.Default,
      allowed_tags: ['webdev', 'development'],
      seniority_level: 'NOT_ENGINEER',
      recent_briefing: {
        sections: [
          {
            title: 'Hard to know',
            items: [
              {
                title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                body: "OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI's previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.",
                postIds: [],
              },
            ],
          },
        ],
        brief_statistics: {
          posts: 3,
          sources: 2,
          saved_time: 40 * 60,
        },
        reading_time: 5 * 60,
        source_ids: ['a', 'b'],
      },
    });

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });

  it('should not include sections with empty items in generated brief', async () => {
    const postId = await generateShortId();

    const post = con.getRepository(BriefPost).create({
      id: postId,
      shortId: postId,
      authorId: 'ugbw-1',
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
                body: 'OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership.',
              },
            ],
          },
          {
            title: 'Empty section',
            items: [],
          },
          {
            title: 'Good to know',
            items: [
              {
                title: 'AI agents are still pretty dumb',
                body: "Salesforce's benchmark found AI agents only 58% successful on single tasks.",
              },
            ],
          },
        ],
      });

    await expectSuccessfulTypedBackground(worker, {
      payload: new UserBriefingRequest({
        userId: 'ugbw-1',
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

- **OpenAI gets a DoD contract, Microsoft gets salty**: OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership.

## Good to know

- **AI agents are still pretty dumb**: Salesforce's benchmark found AI agents only 58% successful on single tasks.`);
    expect(briefPost!.content).not.toContain('Empty section');
  });

  it('should add read more links to items', async () => {
    const postId = await generateShortId();

    const post = con.getRepository(BriefPost).create({
      id: postId,
      shortId: postId,
      authorId: 'ugbw-1',
      private: true,
      visible: false,
    });

    await con.getRepository(BriefPost).save(post);

    let requestBody = null;

    nock('http://api')
      .post('/api/user/briefing', (body) => {
        requestBody = body;

        return true;
      })
      .reply(200, {
        sections: [
          {
            title: 'Must know',
            items: [
              {
                title: 'OpenAI gets a DoD contract, Microsoft gets salty',
                body: 'OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip.',
                postIds: ['post-1', 'post-2', 'post-3'],
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
                postIds: [
                  'post-4',
                  'post-5',
                  'post-6',
                  'post-7',
                  'post-8',
                  'post-9',
                  'post-10',
                  'post-11',
                  'post-12',
                  'post-13',
                  'post-14',
                ],
              },
            ],
          },
        ],
      });

    await expectSuccessfulTypedBackground(worker, {
      payload: new UserBriefingRequest({
        userId: 'ugbw-1',
        frequency: BriefingType.Daily,
        modelName: BriefingModel.Default,
      }),
      postId,
    });

    expect(requestBody).toEqual({
      user_id: 'ugbw-1',
      frequency: BriefingType.Daily,
      model_name: BriefingModel.Default,
      allowed_tags: ['webdev', 'development'],
      seniority_level: 'NOT_ENGINEER',
    });

    const briefPost = await con.getRepository(BriefPost).findOne({
      where: {
        id: postId,
      },
    });

    expect(briefPost).toBeDefined();
    expect(briefPost!.private).toBe(false);
    expect(briefPost!.visible).toBe(true);
    expect(briefPost!.content).toBe(`## Must know

- **OpenAI gets a DoD contract, Microsoft gets salty**: OpenAI landed a $200 million contract with the US Department of Defense for AI tools, marking its first direct federal government partnership. This move, reported by The Verge and TechCrunch, signals a shift from OpenAI’s previous stance on military use. It also puts them in direct competition with Microsoft, their main investor, who previously handled government AI contracts through Azure. The tension is real, with OpenAI reportedly considering an antitrust complaint against Microsoft to loosen their grip. [Read more](http://localhost:5002/feed-by-ids?id=post-1&id=post-2&id=post-3)

## Good to know

- **AI agents are still pretty dumb, and dangerous**: Salesforce's CRMArena-Pro benchmark found AI agents only 58% successful on single tasks and 35% on multi-step CRM tasks, often mishandling sensitive data due to poor confidentiality awareness.
- **Threads gets Fediverse feed**: Meta's Threads now offers a dedicated opt-in feed for ActivityPub content and improved profile search for Fediverse users, marking its most prominent integration with the open social web to date. [Read more](http://localhost:5002/feed-by-ids?id=post-4&id=post-5&id=post-6&id=post-7&id=post-8&id=post-9&id=post-10&id=post-11&id=post-12&id=post-13)`);

    expect(triggerTypedEvent).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.brief-ready',
      {
        payload: new UserBriefingRequest({
          userId: 'ugbw-1',
          frequency: BriefingType.Daily,
          modelName: BriefingModel.Default,
          allowedTags: ['webdev', 'development'],
          seniorityLevel: 'NOT_ENGINEER',
        }),
        postId,
      },
    );
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });
});
