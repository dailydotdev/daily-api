import {
  endOfMonth,
  endOfToday,
  endOfYear,
  endOfYesterday,
  startOfDay,
  startOfMonth,
  startOfToday,
  startOfYear,
  startOfYesterday,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import {
  BoolFilter,
  Filter,
  Operation,
  Quantifier,
  StringListFilter,
  TimeRangeFilter,
} from '@dailydotdev/schema';

export enum SearchTime {
  AllTime = 'AllTime',
  Today = 'Today',
  Yesterday = 'Yesterday',
  LastSevenDays = 'LastSevenDays',
  LastThirtyDays = 'LastThirtyDays',
  LastMonth = 'LastMonth',
  ThisYear = 'ThisYear',
  LastYear = 'LastYear',
}

const MimirFilterCases = {
  BoolFilter: 'boolFilter',
  StringListFilter: 'stringListFilter',
  TimeRangeFilter: 'timeRangeFilter',
} as const;

const getTimeRangeForSearchTime = (time: SearchTime) => {
  const now = new Date();
  switch (time) {
    case SearchTime.Today:
      return {
        start: startOfToday().getTime(),
        end: endOfToday().getTime(),
      };
    case SearchTime.Yesterday:
      return {
        start: startOfYesterday().getTime(),
        end: endOfYesterday().getTime(),
      };
    case SearchTime.LastSevenDays: {
      const start = startOfDay(subDays(now, 6)).getTime();
      const end = endOfToday().getTime();
      return { start, end };
    }
    case SearchTime.LastThirtyDays: {
      const start = startOfDay(subDays(now, 29)).getTime();
      const end = endOfToday().getTime();
      return { start, end };
    }
    case SearchTime.LastMonth: {
      const lastMonth = subMonths(now, 1);
      return {
        start: startOfMonth(lastMonth).getTime(),
        end: endOfMonth(lastMonth).getTime(),
      };
    }
    case SearchTime.ThisYear:
      return {
        start: startOfYear(now).getTime(),
        end: endOfYear(now).getTime(),
      };
    case SearchTime.LastYear: {
      const lastYear = subYears(now, 1);
      return {
        start: startOfYear(lastYear).getTime(),
        end: endOfYear(lastYear).getTime(),
      };
    }
    case SearchTime.AllTime:
    default:
      return null;
  }
};

export const mimirFilterBuilder = ({
  contentCuration = [],
  time,
}: {
  contentCuration?: string[];
  time?: SearchTime;
}): Filter[] => {
  const output: Filter[] = [
    new Filter({
      field: 'private',
      condition: {
        value: new BoolFilter({ value: false }),
        case: MimirFilterCases.BoolFilter,
      },
    }),
  ];

  if (contentCuration && contentCuration.length) {
    output.push(
      new Filter({
        field: 'content_curation',
        condition: {
          value: new StringListFilter({
            value: contentCuration,
            quantifier: Quantifier.ANY,
            operation: Operation.INCLUDE,
          }),
          case: MimirFilterCases.StringListFilter,
        },
      }),
    );
  }

  const timeRange =
    time && time !== SearchTime.AllTime
      ? getTimeRangeForSearchTime(time)
      : null;
  if (timeRange) {
    output.push(
      new Filter({
        field: 'time',
        condition: {
          value: new TimeRangeFilter({
            startTimestamp: BigInt(Math.floor(timeRange.start / 1000)),
            endTimestamp: BigInt(Math.floor(timeRange.end / 1000)),
          }),
          case: MimirFilterCases.TimeRangeFilter,
        },
      }),
    );
  }

  return output;
};

export const mimirSourcePostsFilterBuilder = ({
  sourceId,
}: {
  sourceId: string;
}): Filter[] => [
  new Filter({
    field: 'source_id',
    condition: {
      value: new StringListFilter({
        value: [sourceId],
        quantifier: Quantifier.ANY,
        operation: Operation.INCLUDE,
      }),
      case: MimirFilterCases.StringListFilter,
    },
  }),
  new Filter({
    field: 'deleted',
    condition: {
      value: new BoolFilter({ value: false }),
      case: MimirFilterCases.BoolFilter,
    },
  }),
  new Filter({
    field: 'visible',
    condition: {
      value: new BoolFilter({ value: true }),
      case: MimirFilterCases.BoolFilter,
    },
  }),
  new Filter({
    field: 'banned',
    condition: {
      value: new BoolFilter({ value: false }),
      case: MimirFilterCases.BoolFilter,
    },
  }),
];
