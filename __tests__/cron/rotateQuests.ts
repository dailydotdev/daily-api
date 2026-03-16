import { crons } from '../../src/cron/index';
import dailyCron from '../../src/cron/rotateDailyQuests';
import weeklyCron from '../../src/cron/rotateWeeklyQuests';
import { expectSuccessfulCron } from '../helpers';
import {
  publishQuestRotationUpdate,
  rotateQuestPeriod,
} from '../../src/common/quest';
import { QuestType } from '../../src/entity/Quest';

jest.mock('../../src/common/quest', () => ({
  ...(jest.requireActual('../../src/common/quest') as Record<string, unknown>),
  rotateQuestPeriod: jest.fn(),
  publishQuestRotationUpdate: jest.fn(),
}));

const mockRotateQuestPeriod = rotateQuestPeriod as jest.MockedFunction<
  typeof rotateQuestPeriod
>;
const mockPublishQuestRotationUpdate =
  publishQuestRotationUpdate as jest.MockedFunction<
    typeof publishQuestRotationUpdate
  >;

const periodStart = new Date('2026-03-12T00:00:00.000Z');
const periodEnd = new Date('2026-03-13T00:00:00.000Z');

beforeEach(() => {
  jest.resetAllMocks();
  mockRotateQuestPeriod.mockImplementation(async ({ type }) => ({
    type,
    periodStart,
    periodEnd,
    attempted: type === QuestType.Daily ? 3 : 2,
    created: type === QuestType.Daily ? 3 : 2,
  }));
  mockPublishQuestRotationUpdate.mockResolvedValue();
});

describe('rotate quest crons', () => {
  it('should register the daily and weekly quest rotation crons', () => {
    expect(crons.find((item) => item.name === dailyCron.name)).toBeDefined();
    expect(crons.find((item) => item.name === weeklyCron.name)).toBeDefined();
  });

  it('should publish a rollover update after rotating daily quests', async () => {
    await expectSuccessfulCron(dailyCron);

    expect(mockRotateQuestPeriod).toHaveBeenCalledWith({
      con: expect.anything(),
      logger: expect.anything(),
      type: QuestType.Daily,
    });
    expect(mockPublishQuestRotationUpdate).toHaveBeenCalledWith({
      logger: expect.anything(),
      type: QuestType.Daily,
      periodStart,
      periodEnd,
      updatedAt: expect.any(Date),
    });
  });

  it('should publish a rollover update after rotating weekly quests', async () => {
    await expectSuccessfulCron(weeklyCron);

    expect(mockRotateQuestPeriod).toHaveBeenCalledWith({
      con: expect.anything(),
      logger: expect.anything(),
      type: QuestType.Weekly,
    });
    expect(mockPublishQuestRotationUpdate).toHaveBeenCalledWith({
      logger: expect.anything(),
      type: QuestType.Weekly,
      periodStart,
      periodEnd,
      updatedAt: expect.any(Date),
    });
  });
});
