import { isRoleAtLeast } from '../src/roles';

describe('isRoleAtLeast', () => {
  const hierarchy = ['owner', 'admin', 'user', 'guest'];

  // Test cases where the user's role meets or exceeds the required role
  test('should return true when user role is the same as required role', () => {
    expect(isRoleAtLeast('user', 'user', hierarchy)).toBe(true);
  });

  test('should return true when user role is higher than required role', () => {
    expect(isRoleAtLeast('admin', 'user', hierarchy)).toBe(true);
  });

  test('should return true for the highest role checking against the lowest', () => {
    expect(isRoleAtLeast('owner', 'guest', hierarchy)).toBe(true);
  });

  // Test cases where the user's role is below the required role
  test('should return false when user role is lower than required role', () => {
    expect(isRoleAtLeast('user', 'admin', hierarchy)).toBe(false);
  });

  test('should return false for the lowest role checking against the highest', () => {
    expect(isRoleAtLeast('guest', 'owner', hierarchy)).toBe(false);
  });

  // Test cases with roles not in the hierarchy
  test('should return false when user role is not in the hierarchy', () => {
    expect(isRoleAtLeast('moderator', 'user', hierarchy)).toBe(false);
  });

  test('should return false when required role is not in the hierarchy', () => {
    expect(isRoleAtLeast('user', 'moderator', hierarchy)).toBe(false);
  });

  test('should return false when both roles are not in the hierarchy', () => {
    expect(isRoleAtLeast('moderator', 'editor', hierarchy)).toBe(false);
  });

  test('should return false when user role is not in hierarchy but required role is', () => {
    expect(isRoleAtLeast('moderator', 'admin', hierarchy)).toBe(false);
  });

  test('should return false when required role is not in hierarchy but user role is', () => {
    expect(isRoleAtLeast('admin', 'moderator', hierarchy)).toBe(false);
  });

  // Test cases with empty hierarchy
  test('should return false when hierarchy is empty', () => {
    expect(isRoleAtLeast('user', 'user', [])).toBe(false);
  });

  test('should return false when roles are not in an empty hierarchy', () => {
    expect(isRoleAtLeast('user', 'admin', [])).toBe(false);
  });
});
