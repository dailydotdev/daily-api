import { ValidationError } from 'apollo-server-errors';
import { ObjectLiteral } from 'typeorm';

export const mapArrayToOjbect = <T extends ObjectLiteral>(
  array: T[],
  key: keyof T,
  value: keyof T,
): ObjectLiteral =>
  array.reduce(
    (map, obj) => ({
      ...map,
      [obj[key]]: obj[value],
    }),
    {},
  );

export const isNullOrUndefined = <T>(
  value: T | undefined | null,
): value is undefined | null => typeof value === 'undefined' || value === null;

type Key = string;
type Value = string | undefined;
type IsRequired = boolean;
export type ValidateRegex = [Key, Value, RegExp, IsRequired?];

export const validateRegex = <T extends ObjectLiteral>(
  params: ValidateRegex[],
  data?: T,
): T => {
  const mutatedData: ObjectLiteral = {
    ...data,
  };
  const result = params.reduce((result, [key, value, regex, isRequired]) => {
    if (isNullOrUndefined(value)) {
      return isRequired ? { ...result, [key]: `${key} is required!` } : result;
    }

    const matchResult = value!.match(regex);
    const isValid = !!matchResult;

    if (data && matchResult?.groups?.value) {
      mutatedData[key] = matchResult.groups.value;
    }

    return isValid ? result : { ...result, [key]: `${key} is invalid!` };
  }, {});

  if (Object.keys(result).length) {
    throw new ValidationError(JSON.stringify(result));
  }

  return mutatedData as T;
};
export const nameRegex = new RegExp(/^(.){1,60}$/);
// Updated to support Unicode word characters (including accented characters)
export const socialHandleRegex = new RegExp(/^@?([\p{L}\p{N}_-]){1,39}$/iu);
// Updated to support Unicode word characters (including accented characters)
export const handleRegex = new RegExp(
  /^@?[\p{L}\p{N}]([\p{L}\p{N}_]){2,38}$/iu,
);
export const descriptionRegex = new RegExp(/^[\S\s]{1,250}$/);
// Originated from: https://github.com/colinhacks/zod/blob/8552233c77426f77d3586cc877f7aec1aa0aa45b/src/types.ts#L599-L600
export const emailRegex = new RegExp(
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,
);
