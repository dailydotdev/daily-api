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
type Value = string | undefined;
type IsRequired = boolean;
export type ValidateRegex = [Key, Value, RegExp, IsRequired?];

export const validateRegex = (params: ValidateRegex[]): void => {
  const result = params.reduce((result, [key, value, regex, isRequired]) => {
    if (isNullOrUndefined(value)) {
      return isRequired ? { ...result, [key]: `${key} is required!` } : result;
    }

    const isValid = regex.test(value as string);
    return isValid ? result : { ...result, [key]: `${key} is invalid!` };
  }, {});

  if (Object.keys(result).length) {
    throw new ValidationError(JSON.stringify(result));
  }
};
export const nameRegex = new RegExp(/^(.){1,60}$/);
export const socialHandleRegex = new RegExp(/^@?([\w-]){1,39}$/i);
export const handleRegex = new RegExp(/^@?[a-z0-9](\w){2,38}$/i);
export const descriptionRegex = new RegExp(/^[\S\s]{1,250}$/);
