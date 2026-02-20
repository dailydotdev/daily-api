import { validateGondulOpportunityMessage } from '../../../src/common/schema/opportunities';

describe('validateGondulOpportunityMessage', () => {
  it('should return true for valid UUID opportunityId', () => {
    expect(
      validateGondulOpportunityMessage({
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    ).toBe(true);
  });

  it('should return false for non-UUID opportunityId', () => {
    expect(
      validateGondulOpportunityMessage({ opportunityId: 'not-a-uuid' }),
    ).toBe(false);
  });

  it('should return false for empty string opportunityId', () => {
    expect(validateGondulOpportunityMessage({ opportunityId: '' })).toBe(false);
  });

  it('should return false for undefined opportunityId', () => {
    expect(validateGondulOpportunityMessage({})).toBe(false);
  });

  it('should return false for numeric string opportunityId', () => {
    expect(validateGondulOpportunityMessage({ opportunityId: '12345' })).toBe(
      false,
    );
  });
});
