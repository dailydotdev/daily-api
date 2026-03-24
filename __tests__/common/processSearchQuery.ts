import { ValidationError } from 'apollo-server-errors';
import { processSearchQuery } from '../../src/schema/common';

describe('processSearchQuery', () => {
  it('should join words with AND operator and add prefix', () => {
    expect(processSearchQuery('react vue')).toBe('react & vue:*');
  });

  it('should handle single word', () => {
    expect(processSearchQuery('react')).toBe('react:*');
  });

  it('should trim whitespace', () => {
    expect(processSearchQuery('  react  ')).toBe('react:*');
  });

  it('should preserve special characters for programming languages', () => {
    expect(processSearchQuery('c++')).toBe("'c++':*");
    expect(processSearchQuery('c#')).toBe("'c#':*");
    expect(processSearchQuery('node.js')).toBe("'node.js':*");
    expect(processSearchQuery('.net')).toBe("'.net':*");
  });

  it('should strip tsquery metacharacters from regular queries', () => {
    expect(processSearchQuery('react & vue')).toBe('react & vue:*');
    expect(processSearchQuery('react | vue')).toBe('react & vue:*');
    expect(processSearchQuery('test (query)')).toBe('test & query:*');
  });

  it('should strip tsquery metacharacters from special char queries', () => {
    expect(processSearchQuery('c++ & tricks')).toBe("'c++   tricks':*");
  });

  it('should throw ValidationError for empty query', () => {
    expect(() => processSearchQuery('')).toThrow(ValidationError);
    expect(() => processSearchQuery('   ')).toThrow(ValidationError);
  });

  it('should throw ValidationError when query becomes empty after stripping', () => {
    expect(() => processSearchQuery('& | !')).toThrow(ValidationError);
    expect(() => processSearchQuery('(())')).toThrow(ValidationError);
    expect(() => processSearchQuery(':*')).toThrow(ValidationError);
  });
});
