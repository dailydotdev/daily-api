import {
  destroyAnonymousFunnelSubscription,
  identifyAnonymousFunnelSubscription,
  identifyUserOpportunities,
} from '../src/cio';
import { OpportunityMatchStatus } from '../src/entity/opportunities/types';
import type { ConnectionManager } from '../src/entity';
import type { TrackClient } from 'customerio-node';

// Mock isProd to return true so the function doesn't early return
jest.mock('../src/common/utils', () => ({
  ...jest.requireActual('../src/common/utils'),
  isProd: true,
}));

describe('identifyUserOpportunities', () => {
  it('should call cio.identify with filtered opportunities', async () => {
    const mockMatches = [
      {
        userId: '1',
        opportunityId: 'opp-1',
        opportunity: Promise.resolve({
          id: 'opp-1',
          title: 'Job 1',
          flags: { reminders: true },
        }),
        status: OpportunityMatchStatus.Pending,
      },
      {
        userId: '1',
        opportunityId: 'opp-2',
        opportunity: Promise.resolve({
          id: 'opp-2',
          title: 'Job 2',
          flags: { reminders: false },
        }),
        status: OpportunityMatchStatus.Pending,
      },
    ];

    const mockFind = jest.fn().mockResolvedValue(mockMatches);
    const mockCioIdentify = jest.fn().mockResolvedValue(undefined);

    const mockCon = {
      getRepository: jest.fn().mockReturnValue({
        find: mockFind,
      }),
    } as unknown as ConnectionManager;

    const mockCio = {
      identify: mockCioIdentify,
    } as unknown as TrackClient;

    await identifyUserOpportunities({
      cio: mockCio,
      con: mockCon,
      userId: '1',
    });

    // Verify repository was called correctly
    expect(mockFind).toHaveBeenCalledWith({
      where: { userId: '1', status: OpportunityMatchStatus.Pending },
      relations: ['opportunity'],
      order: { createdAt: 'ASC' },
    });

    // Verify CIO was called with only opportunities where reminders=true
    expect(mockCioIdentify).toHaveBeenCalledWith('1', {
      opportunities: ['opp-1'],
    });
  });

  it('should call cio.identify with null when no reminders enabled', async () => {
    const mockMatches = [
      {
        userId: '1',
        opportunityId: 'opp-1',
        opportunity: Promise.resolve({
          id: 'opp-1',
          title: 'Job 1',
          flags: { reminders: false },
        }),
        status: OpportunityMatchStatus.Pending,
      },
    ];

    const mockFind = jest.fn().mockResolvedValue(mockMatches);
    const mockCioIdentify = jest.fn().mockResolvedValue(undefined);

    const mockCon = {
      getRepository: jest.fn().mockReturnValue({
        find: mockFind,
      }),
    } as unknown as ConnectionManager;

    const mockCio = {
      identify: mockCioIdentify,
    } as unknown as TrackClient;

    await identifyUserOpportunities({
      cio: mockCio,
      con: mockCon,
      userId: '1',
    });

    // Verify CIO was called with null when no reminders
    expect(mockCioIdentify).toHaveBeenCalledWith('1', {
      opportunities: null,
    });
  });

  it('should only include pending matches', async () => {
    const mockMatches = [
      {
        userId: '1',
        opportunityId: 'opp-1',
        opportunity: Promise.resolve({
          id: 'opp-1',
          title: 'Job 1',
          flags: { reminders: true },
        }),
        status: OpportunityMatchStatus.Pending,
      },
    ];

    const mockFind = jest.fn().mockResolvedValue(mockMatches);
    const mockCioIdentify = jest.fn().mockResolvedValue(undefined);

    const mockCon = {
      getRepository: jest.fn().mockReturnValue({
        find: mockFind,
      }),
    } as unknown as ConnectionManager;

    const mockCio = {
      identify: mockCioIdentify,
    } as unknown as TrackClient;

    await identifyUserOpportunities({
      cio: mockCio,
      con: mockCon,
      userId: '1',
    });

    // Verify the where clause filters by Pending status
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OpportunityMatchStatus.Pending,
        }),
      }),
    );
  });
});

describe('anonymous funnel subscription', () => {
  const originalSiteId = process.env.CIO_SITE_ID;
  const originalApiKey = process.env.CIO_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.CIO_SITE_ID = originalSiteId;
    process.env.CIO_API_KEY = originalApiKey;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should skip identify when cio credentials are missing', async () => {
    delete process.env.CIO_SITE_ID;
    delete process.env.CIO_API_KEY;

    const mockCioIdentify = jest.fn();

    const mockCio = {
      identify: mockCioIdentify,
    } as unknown as TrackClient;

    await identifyAnonymousFunnelSubscription({
      cio: mockCio,
      email: 'test@example.com',
      claimedSub: false,
    });

    expect(mockCioIdentify).not.toHaveBeenCalled();
  });

  it('should skip identify in development', async () => {
    process.env.CIO_SITE_ID = 'test-site-id';
    process.env.CIO_API_KEY = 'test-api-key';
    process.env.NODE_ENV = 'development';

    const mockCioIdentify = jest.fn();

    const mockCio = {
      identify: mockCioIdentify,
    } as unknown as TrackClient;

    await identifyAnonymousFunnelSubscription({
      cio: mockCio,
      email: 'test@example.com',
      claimedSub: false,
    });

    expect(mockCioIdentify).not.toHaveBeenCalled();
  });

  it('should skip destroy when cio credentials are missing', async () => {
    delete process.env.CIO_SITE_ID;
    delete process.env.CIO_API_KEY;

    const mockCioDestroy = jest.fn();

    const mockCio = {
      destroy: mockCioDestroy,
    } as unknown as TrackClient;

    await destroyAnonymousFunnelSubscription({
      cio: mockCio,
      email: 'test@example.com',
    });

    expect(mockCioDestroy).not.toHaveBeenCalled();
  });

  it('should skip destroy in development', async () => {
    process.env.CIO_SITE_ID = 'test-site-id';
    process.env.CIO_API_KEY = 'test-api-key';
    process.env.NODE_ENV = 'development';

    const mockCioDestroy = jest.fn();

    const mockCio = {
      destroy: mockCioDestroy,
    } as unknown as TrackClient;

    await destroyAnonymousFunnelSubscription({
      cio: mockCio,
      email: 'test@example.com',
    });

    expect(mockCioDestroy).not.toHaveBeenCalled();
  });
});
