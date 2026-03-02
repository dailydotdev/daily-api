export interface QuestLevelState {
  level: number;
  totalXp: number;
  xpInLevel: number;
  xpToNextLevel: number;
}

const getXpCostForCurrentLevel = (level: number): number => {
  if (level < 10) {
    return 50;
  }

  if (level < 50) {
    return 100;
  }

  if (level < 100) {
    return 200;
  }

  return 300;
};

export const getQuestLevelState = (xp: number): QuestLevelState => {
  const totalXp = Math.max(0, Math.floor(xp));
  let level = 1;
  let remainingXp = totalXp;

  while (remainingXp >= getXpCostForCurrentLevel(level)) {
    remainingXp -= getXpCostForCurrentLevel(level);
    level += 1;
  }

  const xpToNextLevel = getXpCostForCurrentLevel(level) - remainingXp;

  return {
    level,
    totalXp,
    xpInLevel: remainingXp,
    xpToNextLevel,
  };
};
