import { formatInTimeZone } from 'date-fns-tz';
import {
  isWeekend,
  DayOfWeek,
  secondsUntilNextHourInTimezone,
} from '../../src/common/date';
import { ONE_DAY_IN_SECONDS } from '../../src/common/constants';

describe('date', () => {
  describe('secondsUntilNextHourInTimezone', () => {
    const expiryAt = (now: Date, ttl: number): Date =>
      new Date(now.getTime() + ttl * 1000);

    it('should expire at the next 9am in the given timezone', () => {
      const now = new Date('2026-06-19T06:00:00Z');

      ['Etc/UTC', 'America/New_York', 'Asia/Tokyo'].forEach((timezone) => {
        const ttl = secondsUntilNextHourInTimezone({ hour: 9, timezone, now });

        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(ONE_DAY_IN_SECONDS);
        expect(formatInTimeZone(expiryAt(now, ttl), timezone, 'HH:mm')).toBe(
          '09:00',
        );
        expect(expiryAt(now, ttl).getTime()).toBeGreaterThan(now.getTime());
      });
    });

    it('should roll to the next day once 9am has passed in the timezone', () => {
      // 23:00 UTC is already past 9am UTC today, so it targets tomorrow.
      const now = new Date('2026-06-19T23:00:00Z');
      const ttl = secondsUntilNextHourInTimezone({
        hour: 9,
        timezone: 'Etc/UTC',
        now,
      });

      expect(
        formatInTimeZone(expiryAt(now, ttl), 'Etc/UTC', 'yyyy-MM-dd HH:mm'),
      ).toBe('2026-06-20 09:00');
    });

    it('should shift with the timezone for the same instant', () => {
      const now = new Date('2026-06-19T06:00:00Z');
      const utc = secondsUntilNextHourInTimezone({
        hour: 9,
        timezone: 'Etc/UTC',
        now,
      });
      const tokyo = secondsUntilNextHourInTimezone({
        hour: 9,
        timezone: 'Asia/Tokyo',
        now,
      });

      expect(utc).not.toEqual(tokyo);
    });
  });

  describe('isWeekend', () => {
    it('should return true for Saturday and Sunday when the week starts on Monday', () => {
      expect(isWeekend(new Date('2024-08-10'), DayOfWeek.Monday)).toBe(true); // Saturday
      expect(isWeekend(new Date('2024-08-11'), DayOfWeek.Monday)).toBe(true); // Sunday
    });

    it('should return false for weekdays when the week starts on Monday', () => {
      expect(isWeekend(new Date('2024-08-09'), DayOfWeek.Monday)).toBe(false); // Friday
      expect(isWeekend(new Date('2024-08-12'), DayOfWeek.Monday)).toBe(false); // Monday
    });

    it('should return true for Friday and Saturday when the week starts on Sunday', () => {
      expect(isWeekend(new Date('2024-08-09'), DayOfWeek.Sunday)).toBe(true); // Friday
      expect(isWeekend(new Date('2024-08-10'), DayOfWeek.Sunday)).toBe(true); // Saturday
    });

    it('should return false for other days when the week starts on Sunday', () => {
      expect(isWeekend(new Date('2024-08-11'), DayOfWeek.Sunday)).toBe(false); // Sunday
      expect(isWeekend(new Date('2024-08-12'), DayOfWeek.Sunday)).toBe(false); // Monday
    });

    it('should handle date strings correctly', () => {
      expect(isWeekend('2024-08-10', DayOfWeek.Monday)).toBe(true); // Saturday
      expect(isWeekend('2024-08-09', DayOfWeek.Sunday)).toBe(true); // Friday
    });

    it('should handle timestamp numbers correctly', () => {
      expect(isWeekend(Date.parse('2024-08-10'), DayOfWeek.Monday)).toBe(true); // Saturday
      expect(isWeekend(Date.parse('2024-08-09'), DayOfWeek.Sunday)).toBe(true); // Friday
    });

    it('should default to Monday as the start of the week', () => {
      expect(isWeekend(new Date('2024-08-10'))).toBe(true); // Saturday
      expect(isWeekend(new Date('2024-08-11'))).toBe(true); // Sunday
    });
  });
});
