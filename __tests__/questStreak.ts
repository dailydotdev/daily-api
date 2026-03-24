import {
  calculateCurrentQuestStreak,
  calculateLongestQuestStreak,
} from '../src/common/quest/streak';

describe('calculateCurrentQuestStreak', () => {
  const now = new Date('2026-03-22T10:00:00.000Z');

  it('counts consecutive quest completion days ending yesterday', () => {
    const currentStreak = calculateCurrentQuestStreak({
      completedDays: ['2026-03-21', '2026-03-20', '2026-03-19', '2026-03-17'],
      now,
    });

    expect(currentStreak).toBe(3);
  });

  it('deduplicates same-day completions and counts from today', () => {
    const currentStreak = calculateCurrentQuestStreak({
      completedDays: [
        '2026-03-20',
        '2026-03-22T12:00:00.000Z',
        '2026-03-21T09:15:00.000Z',
        '2026-03-22T08:00:00.000Z',
        null,
      ],
      now,
    });

    expect(currentStreak).toBe(3);
  });

  it('returns zero when the user has not completed a quest today or yesterday', () => {
    const currentStreak = calculateCurrentQuestStreak({
      completedDays: ['2026-03-20', '2026-03-19', '2026-03-18'],
      now,
    });

    expect(currentStreak).toBe(0);
  });
});

describe('calculateLongestQuestStreak', () => {
  it('counts the longest run of consecutive completion days', () => {
    const longestStreak = calculateLongestQuestStreak({
      completedDays: [
        '2026-03-21',
        '2026-03-19',
        '2026-03-18',
        '2026-03-17',
        '2026-03-14',
      ],
    });

    expect(longestStreak).toBe(3);
  });

  it('deduplicates same-day completions and returns zero with no history', () => {
    const longestStreak = calculateLongestQuestStreak({
      completedDays: [
        '2026-03-22T12:00:00.000Z',
        '2026-03-22T08:00:00.000Z',
        '2026-03-21',
        null,
      ],
    });

    expect(longestStreak).toBe(2);
    expect(
      calculateLongestQuestStreak({
        completedDays: [],
      }),
    ).toBe(0);
  });
});
