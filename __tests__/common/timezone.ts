import { isSameDay } from 'date-fns';
import {
  isSameDayInTimezone,
  validateValidTimeZone,
} from '../../src/common/timezone';

describe('validateValidTimeZone tests', () => {
  it('should return true for valid time zones', () => {
    const timeZones = [
      'Pacific/Bougainville',
      'Asia/Srednekolymsk',
      'Asia/Magadan',
      'Pacific/Norfolk',
      'Asia/Sakhalin',
      'Pacific/Guadalcanal',
      'Asia/Anadyr',
      'Pacific/Auckland',
      'Pacific/Fiji',
      'Pacific/Chatham',
      'Pacific/Tongatapu',
      'Pacific/Apia',
      'Pacific/Kiritimati',
      'Etc/UTC',
    ];
    timeZones.forEach((tz) => {
      expect(validateValidTimeZone(tz)).toBeTruthy();
    });
  });

  it('should return false for invalid time zones', () => {
    const invalidTimeZones = [
      'Pacific/Invalid',
      'Asia/Invalid',
      'Etc/Invalid',
      'Invalid/Invalid',
      'Invalid/Asia',
      'Invalid/Pacific',
      'Invalid/Etc',
    ];

    invalidTimeZones.forEach((tz) => {
      expect(validateValidTimeZone(tz)).toBeFalsy();
    });
  });
});

describe('isSameDayInTimezone tests', () => {
  it('should return true for same day in UTC timezone', () => {
    const date1 = new Date('2025-03-03T03:33:36.619Z');
    const date2 = new Date('2025-03-03T03:33:36.619Z');

    expect(isSameDay(date1, date2)).toBeTruthy();
    expect(isSameDayInTimezone(date1, date2)).toBeTruthy();
  });

  it('should return false for different day in UTC timezone', () => {
    const date1 = new Date('2025-03-04T03:33:36.619Z');
    const date2 = new Date('2025-03-03T03:33:36.619Z');

    expect(isSameDay(date1, date2)).toBeFalsy();
    expect(isSameDayInTimezone(date1, date2)).toBeFalsy();
  });

  it('should return true for same day in non UTC timezone', () => {
    const date1 = new Date('2025-03-04T01:33:36.619Z');
    const date2 = new Date('2025-03-03T23:33:36.619Z');

    expect(isSameDay(date1, date2)).toBeFalsy();
    expect(isSameDayInTimezone(date1, date2, 'America/New_York')).toBeTruthy();
  });

  it('should return false for different day in non UTC timezone', () => {
    const date1 = new Date('2025-03-04T03:33:36.619Z');
    const date2 = new Date('2025-03-03T03:33:36.619Z');

    expect(isSameDay(date1, date2)).toBeFalsy();
    expect(isSameDayInTimezone(date1, date2, 'America/New_York')).toBeFalsy();
  });
});
