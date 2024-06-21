import { validateValidTimeZone } from '../../src/common';

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
