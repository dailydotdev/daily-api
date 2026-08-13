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
    await con.getRepository(ClaimCandidate).save({
      postId: 'cp1',
      rawEntityName: 'react',
      entityAliases: [],
      entityKind: LedgerEntityKind.Package,
      changeType: ClaimChangeType.Removal,
      statement: 'React 19 removes defaultProps.',
      directness: ClaimDirectness.Announcement,
      evidence: 'React 19 removes defaultProps.',
    });

    await expectSuccessfulTypedBackground<'yggdrasil.v1.content-published'>(
      worker,
      contentPublished(),
    );

    expect(mockExtractClaims).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(await con.getRepository(ClaimCandidate).count()).toEqual(1);
  });
});
