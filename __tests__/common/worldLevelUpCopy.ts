import { worldLevelUpLine } from '../../src/common/worldLevelUpCopy';

const line = (level: number, seed = 'u1:2026-W33') =>
  worldLevelUpLine({ level, seed });

describe('worldLevelUpLine', () => {
  it('should be stable for the same reader and week', () => {
    // A redelivered event has to repeat itself. If it did not, the sentence
    // under a notification the reader already has open would change.
    expect(line(7)).toEqual(line(7));
  });

  it('should move on the following week', () => {
    const weeks = ['2026-W33', '2026-W34', '2026-W35', '2026-W36'].map((week) =>
      line(7, `u1:${week}`),
    );

    expect(new Set(weeks).size).toBeGreaterThan(1);
  });

  it('should not read the same line to everybody at once', () => {
    const readers = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((user) =>
      line(7, `${user}:2026-W33`),
    );

    expect(new Set(readers).size).toBeGreaterThan(1);
  });

  it('should change character as the ladder is climbed', () => {
    const bands = [2, 6, 10, 12].map((level) => line(level));

    expect(new Set(bands).size).toEqual(4);
  });

  it('should give the top of the ladder its own line', () => {
    // L12 is the only rung with nothing above it, and the only one whose band
    // holds a single sentence, so every seed lands on it.
    const tops = ['a', 'b', 'c'].map((seed) => line(12, seed));

    expect(new Set(tops)).toEqual(
      new Set(['Top of the ladder. Nothing above it.']),
    );
  });

  it('should return a line for every rung on the ladder', () => {
    for (let level = 1; level <= 12; level += 1) {
      expect(line(level)).toEqual(expect.any(String));
      expect(line(level).length).toBeGreaterThan(0);
    }
  });

  it('should fall back rather than break on a rung off the ladder', () => {
    // Nothing should produce a 0, but a missing line is a broken notification
    // and an unexpected level is not worth one.
    expect(line(0)).toEqual(expect.any(String));
    expect(line(99)).toEqual(expect.any(String));
  });
});
