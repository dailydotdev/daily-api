import { ListValue, Value } from '@bufbuild/protobuf';

export const stringArrayToListValue = (arr?: string[] | null): ListValue => {
  return new ListValue({
    values: arr?.map(
      (value) =>
        new Value({
          kind: {
            case: 'stringValue',
            value: value,
          },
        }),
    ),
  });
};

export const protoToGQLEnum = <T>(value: T, name: string) => {
  return `enum ${name} { ${Object.keys(
    value as unknown as Record<string, number>,
  )
    .filter((key) => isNaN(Number(key)))
    .join(' ')} }`;
};

export const protoEnumToConstant = <T>(
  value: T,
): Readonly<Record<keyof T, keyof T>> =>
  Object.freeze(
    Object.fromEntries(
      Object.keys(value as unknown as Record<string, number>)
        .filter((key) => isNaN(Number(key)))
        .map((key) => [key, key]),
    ),
  ) as Readonly<Record<keyof T, keyof T>>;

/**
 * List all numeric values from a protobuf enum object.
 *
 * By default the function filters out the 'UNSPECIFIED' / zero value (commonly 0),
 * but includeUnspecified=true will keep it.
 *
 * Example:
 *   listAllProtoEnumValues(SomeProtoEnum) // -> [1,2,3]
 *   listAllProtoEnumValues(SomeProtoEnum, true) // -> [0,1,2,3]
 *
 * @param value - protobuf enum object.
 * @param includeUnspecified - when true, include zero (commonly "UNSPECIFIED") values.
 * @returns array of numeric enum values.
 */
export const listAllProtoEnumValues = <T>(
  value: T,
  includeUnspecified = false,
): number[] => {
  return Object.values(value as unknown as Record<string, number>)
    .filter((v) => !isNaN(Number(v)))
    .filter((v) => includeUnspecified || v !== 0) as number[];
};

export /**
 * Extract the text name from a protobuf enum value.
 *
 * @template T
 * @param {T} enumObj
 * @param {(number | string | undefined)} value
 * @param {string} [defaultValue='Not specified']
 * @return {*}  {string}
 */
const textFromEnumValue = <T extends Record<string, unknown>>(
  enumObj: T,
  value: number | string | undefined,
  defaultValue = 'Not specified',
): string => {
  return (
    Object.entries(enumObj).find(([, enumValue]) => enumValue === value)?.[0] ??
    defaultValue
  );
};
