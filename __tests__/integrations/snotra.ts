import nock from 'nock';
import { SnotraClient } from '../../src/integrations/snotra/clients';
import { PersonaliseState } from '../../src/integrations/snotra/types';

const url = 'http://snotra.local:3000';

beforeEach(() => {
  nock.cleanAll();
});

describe('SnotraClient.getUserProfile', () => {
  it('should POST to /api/v1/user/profile and return parsed response', async () => {
    let capturedBody: unknown;
    nock(url)
      .post('/api/v1/user/profile', (body) => {
        capturedBody = body;
        return true;
      })
      .reply(200, {
        personalise: { state: PersonaliseState.Personalised },
      });

    const client = new SnotraClient(url);
    const response = await client.getUserProfile({
      user_id: 'u1',
      providers: { personalise: {} },
    });

    expect(capturedBody).toEqual({
      user_id: 'u1',
      providers: { personalise: {} },
    });
    expect(response).toEqual({
      personalise: { state: PersonaliseState.Personalised },
    });
  });
});
