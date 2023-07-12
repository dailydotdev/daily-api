import '../src/config';
import createOrGetConnection from '../src/db';

(async (): Promise<void> => {
  const createdFromArgument = process.argv[2];
  const createdToArgument = process.argv[3];

  if (!createdFromArgument || !createdToArgument) {
    throw new Error('createdFrom and createdTo arguments are required');
  }

  const createdFromDate = new Date(createdFromArgument);

  if (Number.isNaN(createdFromDate.getTime())) {
    throw new Error(
      'createdFromDate argument is invalid, format should be ISO 6801',
    );
  }

  const createdToDate = new Date(createdToArgument);

  if (Number.isNaN(createdToDate.getTime())) {
    throw new Error(
      'createdToDate argument is invalid, format should be ISO 6801',
    );
  }

  if (createdFromDate > createdToDate) {
    throw new Error(
      'createdFrom argument should be less than createdTo argument',
    );
  }

  const con = await createOrGetConnection();

  await con.transaction(async (manager) => {
    await manager.query(
      `UPDATE post SET flags = flags || jsonb_build_object('sentAnalyticsReport', "sentAnalyticsReport", 'banned', "banned", 'deleted', "deleted", 'private', "private", 'visible', "visible", 'showOnFeed', "showOnFeed") WHERE "createdAt" > '${createdFromDate.toISOString()}' AND "createdAt" < '${createdToDate.toISOString()}'`,
    );
  });

  process.exit();
})();
