import { isWeekend, DayOfWeek } from '../../src/common/date';

describe('date', () => {
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
