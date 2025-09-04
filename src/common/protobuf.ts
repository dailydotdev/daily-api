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
