import { parseArgs } from 'node:util';
import { addMonths, addYears, startOfMonth, startOfYear } from 'date-fns';
import z from 'zod';
import '../src/config';
import {
  ArchivePeriodType,
  materializeArchivesForPeriodStart,
} from '../src/common/archive';
import { enumValues } from '../src/common/schema/utils';
import createOrGetConnection from '../src/db';

const parsePeriodStart = ({
  periodType,
  value,
}: {
  periodType: ArchivePeriodType;
  value: string;
}): Date => {
  if (periodType === ArchivePeriodType.Month) {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      throw new Error('Monthly periods must use YYYY-MM format');
    }

    const [, year, month] = match;
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0));
  }

  const match = value.match(/^(\d{4})$/);
  if (!match) {
    throw new Error('Yearly periods must use YYYY format');
  }

  return new Date(Date.UTC(Number(match[1]), 0, 1, 0, 0, 0, 0));
};

const formatPeriodStart = ({
  periodType,
  periodStart,
}: {
  periodType: ArchivePeriodType;
  periodStart: Date;
}) =>
  periodType === ArchivePeriodType.Month
    ? periodStart.toISOString().slice(0, 7)
    : periodStart.toISOString().slice(0, 4);

const getCurrentOpenPeriodStart = ({
  now,
  periodType,
}: {
  now: Date;
  periodType: ArchivePeriodType;
}) =>
  periodType === ArchivePeriodType.Month ? startOfMonth(now) : startOfYear(now);

const getNextPeriodStart = ({
  periodType,
  periodStart,
}: {
  periodType: ArchivePeriodType;
  periodStart: Date;
}) =>
  periodType === ArchivePeriodType.Month
    ? addMonths(periodStart, 1)
    : addYears(periodStart, 1);

const argsSchema = z.object({
  period: z.enum(enumValues(ArchivePeriodType)),
  from: z.string().min(1),
  to: z.string().min(1).optional(),
  dryRun: z.coerce.boolean().default(false),
});

const main = async () => {
  const { values } = parseArgs({
    options: {
      period: { type: 'string', short: 'p' },
      from: { type: 'string', short: 'f' },
      to: { type: 'string', short: 't' },
      dryRun: { type: 'boolean' },
    },
  });

  const parsedArgs = argsSchema.safeParse(values);
  if (!parsedArgs.success) {
    throw new Error(parsedArgs.error.issues[0].message);
  }

  const periodType = parsedArgs.data.period;
  const from = parsePeriodStart({
    periodType,
    value: parsedArgs.data.from,
  });
  const to = parsePeriodStart({
    periodType,
    value: parsedArgs.data.to ?? parsedArgs.data.from,
  });

  if (to < from) {
    throw new Error('to must be greater than or equal to from');
  }

  const currentOpenPeriodStart = getCurrentOpenPeriodStart({
    now: new Date(),
    periodType,
  });

  const periodStarts: Date[] = [];
  for (
    let periodStart = from;
    periodStart <= to;
    periodStart = getNextPeriodStart({ periodType, periodStart })
  ) {
    if (periodStart >= currentOpenPeriodStart) {
      throw new Error(
        `Cannot backfill open period ${formatPeriodStart({ periodType, periodStart })}`,
      );
    }

    periodStarts.push(periodStart);
  }

  if (parsedArgs.data.dryRun) {
    console.log(
      `Would materialize ${periodStarts.length} ${periodType} archive period(s):`,
    );
    periodStarts.forEach((periodStart) =>
      console.log(formatPeriodStart({ periodType, periodStart })),
    );
    return;
  }

  const con = await createOrGetConnection();

  try {
    for (const periodStart of periodStarts) {
      console.log(
        `Materializing ${periodType} archives for ${formatPeriodStart({
          periodType,
          periodStart,
        })}...`,
      );

      await materializeArchivesForPeriodStart({
        con,
        periodType,
        periodStart,
      });
    }
  } finally {
    await con.destroy();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
