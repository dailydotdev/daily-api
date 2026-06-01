export const enumValues = <T extends Record<string, string>>(value: T) =>
  Object.values(value) as [T[keyof T], ...T[keyof T][]];
