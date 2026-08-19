import { gzipSync } from 'node:zlib';
import { createClient, createRouterTransport } from '@connectrpc/connect';
import { Storage } from '@google-cloud/storage';
import {
  Claim as ProtoClaim,
  ClaimChangeType as ProtoClaimChangeType,
  ClaimDirectness as ProtoClaimDirectness,
  ClaimEntityKind as ProtoClaimEntityKind,
  ContentFormat,
  ExtractClaimsResponse,
  Pipelines,
} from '@dailydotdev/schema';
import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  createGarmrMock,
  expectSuccessfulTypedBackground,
  saveFixtures,
} from '../helpers';
import worker from '../../src/workers/extractClaims';
import { typedWorkers } from '../../src/workers';
import { ClaimChangeType } from '../../src/entity/claim/Claim';
import {
  ClaimCandidate,
  ClaimCandidateStatus,
  ClaimDirectness,
} from '../../src/entity/claim/ClaimCandidate';
import { LedgerEntityKind } from '../../src/entity/claim/LedgerEntity';
import { PostType } from '../../src/entity/posts/Post';
import { Source } from '../../src/entity/Source';
import { sourcesFixture } from '../fixture/source';
import * as bragiClients from '../../src/integrations/bragi/clients';
import type { ServiceClient } from '../../src/types';
import type { Data } from '../../src/workers/postUpdated/types';

jest.mock('@google-cloud/storage');

const mockDownload = jest.fn();
const mockExtractClaims = jest.fn();

const cleanedXml = '<doc><p>React 19 removes defaultProps.</p></doc>';

const createTransport = () =>
  createRouterTransport(({ service }) => {
    service(Pipelines, {
      extractClaims: (request) => mockExtractClaims(request),
    });
  });

const contentPublished = (overrides: Partial<Data> = {}): Data =>
  ({
    id: 'ygg-1',
    post_id: 'cp1',
    url: 'https://daily.dev/react-19',
    title: 'React 19 is out',
    source_id: 'a',
    published_at: '2026-03-11T00:00:00.000Z',
    meta: {
      change_signal: 'clear',
      cleaned: [
        {
          resource_location:
            'gs://daily-dev-yggdrasil-cleaned-content/cleaned/cp1.xml.gz',
        },
      ],
    },
    ...overrides,
  }) as Data;

const candidateFixture = () => ({
  postId: 'cp1',
  rawEntityName: 'react',
  entityAliases: [],
  entityKind: LedgerEntityKind.Package,
  changeType: ClaimChangeType.Removal,
  statement: 'React 19 removes defaultProps for function components.',
  directness: ClaimDirectness.Announcement,
  evidence: 'React 19 removes defaultProps.',
});

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);

  const mockBucket = {
    file: jest.fn().mockReturnValue({ download: mockDownload }),
  };
  (Storage as unknown as jest.Mock).mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue(mockBucket),
  }));
  mockDownload.mockResolvedValue([gzipSync(Buffer.from(cleanedXml))]);

  jest
    .spyOn(bragiClients, 'getBragiClient')
    .mockImplementation((): ServiceClient<typeof Pipelines> => {
      return {
        instance: createClient(Pipelines, createTransport()),
        garmr: createGarmrMock(),
      };
    });
  mockExtractClaims.mockResolvedValue(
    new ExtractClaimsResponse({ id: 'op-1', model: 'test', claims: [] }),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('extractClaims worker', () => {
  it('should be registered', () => {
    expect(
      typedWorkers.find((item) => item.subscription === worker.subscription),
    ).toBeDefined();
  });

  it('should persist a candidate per extracted claim', async () => {
    mockExtractClaims.mockResolvedValue(
      new ExtractClaimsResponse({
        id: 'op-1',
        model: 'test',
        claims: [
          new ProtoClaim({
            entityName: 'react',
            entityAliases: ['React.js'],
            entityKind: ProtoClaimEntityKind.PACKAGE,
            changeType: ProtoClaimChangeType.REMOVAL,
            statement: 'React 19 removes defaultProps for function components.',
            versionScope: '>= 19',
            effectiveDate: '2026-03',
            sunsetDate: '',
            supersededBy: '',
            directness: ProtoClaimDirectness.ANNOUNCEMENT,
            evidence: 'React 19 removes defaultProps.',
            affected: ['defaultProps'],
            superseding: ['default parameters'],
          }),
          new ProtoClaim({
            entityName: 'react',
            changeType: ProtoClaimChangeType.UNSPECIFIED,
            statement: 'Unclassifiable change',
            directness: ProtoClaimDirectness.REPORT,
            evidence: 'noise',
          }),
        ],
      }),
    );

    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished(),
    );

    expect(mockExtractClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 'cp1',
        title: 'React 19 is out',
        contentFormat: ContentFormat.XML,
        content: cleanedXml,
        url: 'https://daily.dev/react-19',
        source: sourcesFixture[0].name,
        publishedDate: '2026-03-11',
      }),
    );

    const candidates = await con.getRepository(ClaimCandidate).find();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      postId: 'cp1',
      rawEntityName: 'react',
      entityAliases: ['React.js'],
      entityKind: LedgerEntityKind.Package,
      changeType: ClaimChangeType.Removal,
      versionScope: '>= 19',
      effectiveDate: '2026-03-01',
      sunsetDate: null,
      supersededBy: null,
      directness: ClaimDirectness.Announcement,
      status: ClaimCandidateStatus.Pending,
      affected: ['defaultProps'],
      superseding: ['default parameters'],
    });
  });

  it('should map a change type the proto gained after the ledger shipped', async () => {
    mockExtractClaims.mockResolvedValue(
      new ExtractClaimsResponse({
        id: 'op-1',
        model: 'test',
        claims: [
          new ProtoClaim({
            entityName: 'vercel',
            entityKind: ProtoClaimEntityKind.SERVICE,
            changeType: ProtoClaimChangeType.PRICING,
            statement: 'Vercel raises the price of a Pro seat.',
            directness: ProtoClaimDirectness.ANNOUNCEMENT,
            evidence: 'Pro seats now cost more.',
          }),
        ],
      }),
    );

    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished(),
    );

    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ postId: 'cp1' }),
    ).toMatchObject({ changeType: ClaimChangeType.Pricing });
  });

  it('should file one candidate when the response states the same fact twice', async () => {
    const duplicated = {
      entityName: 'react',
      entityKind: ProtoClaimEntityKind.PACKAGE,
      changeType: ProtoClaimChangeType.REMOVAL,
      statement: 'React 19 removes defaultProps for function components.',
      directness: ProtoClaimDirectness.ANNOUNCEMENT,
      evidence: 'React 19 removes defaultProps.',
    };
    mockExtractClaims.mockResolvedValue(
      new ExtractClaimsResponse({
        id: 'op-1',
        model: 'test',
        claims: [
          new ProtoClaim(duplicated),
          new ProtoClaim({
            ...duplicated,
            statement: `  ${duplicated.statement}  `,
            evidence: 'defaultProps are gone.',
          }),
          new ProtoClaim({
            ...duplicated,
            changeType: ProtoClaimChangeType.NEW_CAPABILITY,
            statement: 'React 19 adds the use hook.',
          }),
        ],
      }),
    );

    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished(),
    );

    expect(
      (await con.getRepository(ClaimCandidate).find())
        .map(({ statement }) => statement)
        .sort(),
    ).toEqual([
      'React 19 adds the use hook.',
      'React 19 removes defaultProps for function components.',
    ]);
  });

  it('should extract a tweet from its inline text when there is no cleaned artifact', async () => {
    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished({
        content_type: PostType.SocialTwitter,
        title: undefined,
        url: 'https://x.com/openaidevs/status/1',
        extra: { content: 'GPT-4o is deprecated in the API on 2026-09-01.' },
        meta: { change_signal: 'clear' },
      }),
    );

    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockExtractClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 'cp1',
        title: 'GPT-4o is deprecated in the API on 2026-09-01.',
        contentFormat: ContentFormat.Markdown,
        content: 'GPT-4o is deprecated in the API on 2026-09-01.',
      }),
    );
  });

  it('should extract a thread from its reassembled text', async () => {
    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished({
        content_type: PostType.SocialTwitter,
        title: undefined,
        url: 'https://x.com/openaidevs/status/1',
        extra: {
          content: 'Shipping today:',
          thread_tweets: [
            { tweet_id: '2', content: 'GPT-4o retires 2026-09-01.' },
          ],
        },
        meta: { change_signal: 'clear' },
      } as Partial<Data>),
    );

    expect(mockExtractClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        contentFormat: ContentFormat.Markdown,
        content: 'Shipping today:\n\nGPT-4o retires 2026-09-01.',
      }),
    );
  });

  it('should skip freeform posts so private squad content stays out', async () => {
    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished({
        content_type: PostType.Freeform,
        extra: { content: 'We hit a breaking change in the internal SDK.' },
        meta: { change_signal: 'clear' },
      }),
    );

    expect(mockExtractClaims).not.toHaveBeenCalled();
    expect(await con.getRepository(ClaimCandidate).count()).toEqual(0);
  });

  it('should extract a video from its scraped captions', async () => {
    // Article XML is stored gzipped; captions are written to their own bucket
    // as plain text, so this exercises the uncompressed path too.
    const captions = 'In Next.js 16 the app directory is no longer optional.';
    mockDownload.mockResolvedValue([Buffer.from(captions)]);

    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished({
        content_type: PostType.VideoYouTube,
        title: 'What changed in Next.js 16',
        meta: {
          change_signal: 'clear',
          scraped: {
            resource_location:
              'gs://daily-dev-yggdrasil-scraped-captions/cp1.txt',
          },
        },
      }),
    );

    expect(mockExtractClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'What changed in Next.js 16',
        contentFormat: ContentFormat.Markdown,
        content: captions,
      }),
    );
  });

  it('should not fall back to the raw page scrape for an article', async () => {
    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished({
        meta: {
          change_signal: 'clear',
          scraped: {
            resource_location:
              'gs://daily-dev-yggdrasil-scraped-content/cp1.html',
          },
        },
      }),
    );

    expect(mockExtractClaims).not.toHaveBeenCalled();
  });

  it('should skip posts without a clear change signal', async () => {
    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished({
        meta: { cleaned: [{ resource_location: 'gs://b/o' }] },
      }),
    );

    expect(mockExtractClaims).not.toHaveBeenCalled();
    expect(await con.getRepository(ClaimCandidate).count()).toEqual(0);
  });

  it('should write nothing when no claims are extracted', async () => {
    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished(),
    );

    expect(mockExtractClaims).toHaveBeenCalled();
    expect(await con.getRepository(ClaimCandidate).count()).toEqual(0);
  });

  it('should not extract again once the post has candidates', async () => {
    await con.getRepository(ClaimCandidate).save(candidateFixture());

    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished(),
    );

    expect(mockExtractClaims).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(await con.getRepository(ClaimCandidate).count()).toEqual(1);
  });

  it('should file nothing when another delivery files while extracting', async () => {
    mockExtractClaims.mockImplementation(async () => {
      await con.getRepository(ClaimCandidate).insert(candidateFixture());

      return new ExtractClaimsResponse({
        id: 'op-1',
        model: 'test',
        claims: [
          new ProtoClaim({
            entityName: 'react',
            entityKind: ProtoClaimEntityKind.PACKAGE,
            changeType: ProtoClaimChangeType.REMOVAL,
            statement: candidateFixture().statement,
            directness: ProtoClaimDirectness.ANNOUNCEMENT,
            evidence: 'React 19 removes defaultProps.',
          }),
        ],
      });
    });

    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished(),
    );

    expect(await con.getRepository(ClaimCandidate).count()).toEqual(1);
  });

  it('should ignore a statement already filed for the post', async () => {
    await con.getRepository(ClaimCandidate).insert(candidateFixture());
    await con
      .createQueryBuilder()
      .insert()
      .into(ClaimCandidate)
      .values(candidateFixture())
      .orIgnore()
      .execute();

    expect(await con.getRepository(ClaimCandidate).count()).toEqual(1);
  });

  it('should leave duplicates filed before the index was added alone', async () => {
    const createdAt = new Date('2026-08-13T00:00:00.000Z');
    await con.getRepository(ClaimCandidate).insert([
      { ...candidateFixture(), createdAt },
      { ...candidateFixture(), createdAt },
    ]);

    expect(await con.getRepository(ClaimCandidate).count()).toEqual(2);
  });
});
