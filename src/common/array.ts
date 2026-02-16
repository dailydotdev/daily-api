export const unwrapArray = <T>(
  arrayOrValue: T[] | T | undefined,
): T | undefined => {
  if (Array.isArray(arrayOrValue)) {
    return arrayOrValue[0];
  }

  return arrayOrValue;
};
