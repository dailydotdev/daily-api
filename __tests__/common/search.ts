import { defaultSearchLimit, getSearchLimit } from '../../src/common/search';

describe('getSearchLimit', () => {
  it('should return default limit', () => {
    expect(getSearchLimit({ limit: undefined })).toBe(defaultSearchLimit);
  });

  it('should return custom search limit', () => {
    expect(getSearchLimit({ limit: 20 })).toBe(20);
  });

  it('should return max search limit', () => {
    expect(getSearchLimit({ limit: 200 })).toBe(100);
  });

  it('should return min search limit', () => {
    expect(getSearchLimit({ limit: 0 })).toBe(1);
  });
});
