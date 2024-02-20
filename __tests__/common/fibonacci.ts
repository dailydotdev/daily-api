import { isFibonacci } from '../../src/common/fibonacci';

describe('isFibonacci tests', () => {
  it('should return true for fibonacci numbers', () => {
    const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
    fibs.forEach((n) => {
      expect(isFibonacci(n)).toBeTruthy();
    });
  });

  it('should return false for non-fibonacci numbers', () => {
    const nonFibs = [4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 99];
    nonFibs.forEach((n) => {
      expect(isFibonacci(n)).toBeFalsy();
    });
  });
});
