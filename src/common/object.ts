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

export const isNullOrUndefined = (value: unknown) =>
  typeof value === 'undefined' || value === null;

type Key = string;
type Value = string;
type IsRequired = boolean;
export type ValidateRegex = [Key, Value, RegExp, IsRequired?];

export const validateRegex = (
  params: ValidateRegex[],
): Record<string, string> =>
  params.reduce((result, [key, value, regex, isRequired]) => {
    if (isNullOrUndefined(value)) {
      return isRequired ? { ...result, [key]: `${key} is required!` } : result;
    }

    const isValid = regex.test(value);
    return isValid ? result : { ...result, [key]: `${key} is invalid!` };
  }, {});

export const nameRegex = new RegExp(/^(.){1,60}$/);
export const handleRegex = new RegExp(/^@?([\w-]){1,39}$/i);
export const descriptionRegex = new RegExp(/^(.){1,250}$/);

export const validateRegexOrFail = (params: ValidateRegex[]): void => {
  const regexResult = validateRegex(params);

  if (Object.keys(regexResult).length) {
    throw new ValidationError(JSON.stringify(regexResult));
  }
};
