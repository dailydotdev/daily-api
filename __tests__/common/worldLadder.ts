import {
  districtLevelOf,
  WORLD_LEVEL_UP_MIN_LEVEL,
} from '../../src/common/worldLadder';

describe('districtLevelOf', () => {
  it('should give untouched ground no rung at all', () => {
    expect(districtLevelOf(0)).toBe(0);
    expect(districtLevelOf(-1)).toBe(0);
  });

  it('should land exactly on a rung at its threshold', () => {
    // The thresholds themselves, in order. A district holding exactly what a
    // rung asks for is ON that rung, not one below it — an off-by-one here is a
    // notification that claims a level the world has not drawn.
    expect(districtLevelOf(1)).toBe(1);
    expect(districtLevelOf(2)).toBe(2);
    expect(districtLevelOf(3)).toBe(3);
    expect(districtLevelOf(5)).toBe(4);
    expect(districtLevelOf(10)).toBe(5);
    expect(districtLevelOf(20)).toBe(6);
    expect(districtLevelOf(40)).toBe(7);
    expect(districtLevelOf(80)).toBe(8);
    expect(districtLevelOf(160)).toBe(9);
    expect(districtLevelOf(320)).toBe(10);
    expect(districtLevelOf(640)).toBe(11);
    expect(districtLevelOf(1280)).toBe(12);
  });

  it('should hold the rung below the next threshold', () => {
    expect(districtLevelOf(4)).toBe(3);
    expect(districtLevelOf(9)).toBe(4);
    expect(districtLevelOf(39)).toBe(6);
  });

  it('should top out at twelve', () => {
    expect(districtLevelOf(100_000)).toBe(12);
  });

  it('should put the notification floor on a rung that exists', () => {
    expect(WORLD_LEVEL_UP_MIN_LEVEL).toBeGreaterThan(0);
    expect(WORLD_LEVEL_UP_MIN_LEVEL).toBeLessThanOrEqual(12);
  });
});
