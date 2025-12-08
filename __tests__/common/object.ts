import {
  nameRegex,
  socialHandleRegex,
  handleRegex,
  descriptionRegex,
  emailRegex,
  mapArrayToOjbect,
  isNullOrUndefined,
  validateRegex,
} from '../../src/common/object';

describe('nameRegex', () => {
  it('accepts names from 1 to 60 characters', () => {
    expect(nameRegex.test('A')).toBe(true);
    expect(nameRegex.test('John Doe')).toBe(true);
    expect(nameRegex.test('A'.repeat(60))).toBe(true);
  });

  it('rejects names longer than 60 characters or empty', () => {
    expect(nameRegex.test('')).toBe(false);
    expect(nameRegex.test('A'.repeat(61))).toBe(false);
  });
});

describe('socialHandleRegex (Unicode, optional @, length 1–39)', () => {
  it('accepts Unicode letters, digits, underscore, and hyphen', () => {
    const validHandles = [
      '@José',
      'François',
      'ítalo-oliveira',
      'Müller',
      '北京',
      'johndoe_123',
      '@José_González',
      'François-dev',
      'Müller_Corp',
      'john_doe',
      '@a',
      '@' + 'a'.repeat(39),
      'a'.repeat(39),
    ];

    validHandles.forEach((handle) =>
      expect(socialHandleRegex.test(handle)).toBe(true)
    );
  });

  it('rejects invalid characters and length > 39 in the main part', () => {
    const invalidHandles = [
      '@',
      '',
      'a'.repeat(40),
      '@' + 'a'.repeat(40),
      'has space',
      'bad!char',
    ];

    invalidHandles.forEach((handle) =>
      expect(socialHandleRegex.test(handle)).toBe(false),
    );
  });
});

describe('handleRegex (Unicode, optional @, 3–39 chars, no hyphen)', () => {
    it('accepts 3–39 characters, first is letter/digit, rest letter/digit/underscore', () => {
        const validHandles = [
            'abc',
            '@abc',
            'äbc',
            'user_name',
            '@user_name',
            'Jöhn123',
            '@Jöhn_123',
            'a' + '_'.repeat(2),
            '@' + 'a'.repeat(39),
        ];

        validHandles.forEach((handle) =>
            expect(handleRegex.test(handle)).toBe(true)
        );
    });

    it('rejects too short, too long, or hyphenated handles', () => {
        const invalidHandles = [
            'ab',
            '@ab',
            'a',
            '@a',
            'a'.repeat(40),
            '@' + 'a'.repeat(40),
            'François-dev',
            'bad handle',
            'bad!char',
        ];

        invalidHandles.forEach((handle) =>
            expect(handleRegex.test(handle)).toBe(false)
        );
    });
});

describe('descriptionRegex (1–250 chars, any characters)', () => {
  it('accepts descriptions from 1 to 250 characters including newlines', () => {
    const validDescriptions = [
      'This is a valid description.',
      'A'.repeat(250),
      'Line 1\nLine 2\nLine 3',
    ];

    validDescriptions.forEach((desc) =>
      expect(descriptionRegex.test(desc)).toBe(true)
    );
  });

  it('rejects empty or > 250 characters', () => {
    const invalidDescriptions = ['', 'A'.repeat(251)];

    invalidDescriptions.forEach((desc) =>
      expect(descriptionRegex.test(desc)).toBe(false)
    );
  });
});

describe('emailRegex', () => {
  it('accepts valid emails', () => {
    const validEmails = [
      'test@example.com',
      'user.name+tag+sorting@example.com',
      'USER_123@example.co.uk',
    ];

    validEmails.forEach((email) => expect(emailRegex.test(email)).toBe(true));
  });

  it('rejects invalid emails', () => {
    const invalidEmails = [
      'plainaddress',
      '@missingusername.com',
      'username@.com',
      'user..dot@example.com',
      '.user@example.com',
    ];

    invalidEmails.forEach((email) =>
      expect(emailRegex.test(email)).toBe(false)
    );
  });
});

describe('mapArrayToOjbect', () => {
  it('should map array of objects to object using specified keys', () => {
    const array = [
      { id: '1', name: 'John' },
      { id: '2', name: 'Jane' },
      { id: '3', name: 'Bob' },
    ];

    const result = mapArrayToOjbect(array, 'id', 'name');

    expect(result).toEqual({
      '1': 'John',
      '2': 'Jane',
      '3': 'Bob',
    });
  });

  it('should handle empty array', () => {
    const result = mapArrayToOjbect([], 'id', 'name');
    expect(result).toEqual({});
  });
});

describe('isNullOrUndefined', () => {
  it('should return true for null', () => {
    expect(isNullOrUndefined(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isNullOrUndefined(undefined)).toBe(true);
  });

  it('should return false for other values', () => {
    expect(isNullOrUndefined('')).toBe(false);
    expect(isNullOrUndefined(0)).toBe(false);
    expect(isNullOrUndefined(false)).toBe(false);
    expect(isNullOrUndefined({})).toBe(false);
    expect(isNullOrUndefined([])).toBe(false);
  });
});

describe('validateRegex', () => {
  it('should validate successfully and return data', () => {
    const params: any = [
      ['name', 'John Doe', nameRegex],
      ['email', 'test@example.com', emailRegex],
    ];

    const result = validateRegex(params, {});

    expect(result).toEqual({});
  });

  it('should mutate data with captured groups', () => {
    const regexWithGroups = new RegExp(/^(?<value>\w+)@example\.com$/);
    const params: any = [
      ['email', 'test@example.com', regexWithGroups],
    ];

    const result = validateRegex(params, {});

    expect(result).toEqual({ email: 'test' });
  });

  it('should throw ValidationError for invalid data', () => {
    const params: any = [
      ['name', '', nameRegex, true],
    ];

    expect(() => validateRegex(params, {})).toThrow();
  });

  it('should not require optional fields', () => {
    const params: any = [
      ['name', undefined, nameRegex],
    ];

    const result = validateRegex(params, {});
    expect(result).toEqual({});
  });
});
