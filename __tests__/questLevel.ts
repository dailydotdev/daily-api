import { getQuestLevelState } from '../src/common/quest/level';

describe('getQuestLevelState', () => {
  it('should return level 1 at zero xp', () => {
    expect(getQuestLevelState(0)).toEqual({
      level: 1,
      totalXp: 0,
      xpInLevel: 0,
      xpToNextLevel: 50,
    });
  });

  it('should calculate the level-10 boundary correctly', () => {
    expect(getQuestLevelState(449).level).toBe(9);
    expect(getQuestLevelState(450).level).toBe(10);
    expect(getQuestLevelState(550).level).toBe(11);
  });

  it('should calculate the level-50 boundary correctly', () => {
    expect(getQuestLevelState(4449).level).toBe(49);
    expect(getQuestLevelState(4450).level).toBe(50);
    expect(getQuestLevelState(4650).level).toBe(51);
  });

  it('should calculate the level-100 boundary correctly', () => {
    expect(getQuestLevelState(14449).level).toBe(99);
    expect(getQuestLevelState(14450).level).toBe(100);
    expect(getQuestLevelState(14750).level).toBe(101);
  });

  it('should clamp negative values to zero', () => {
    expect(getQuestLevelState(-100)).toEqual({
      level: 1,
      totalXp: 0,
      xpInLevel: 0,
      xpToNextLevel: 50,
    });
  });
});
