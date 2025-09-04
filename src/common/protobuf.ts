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
