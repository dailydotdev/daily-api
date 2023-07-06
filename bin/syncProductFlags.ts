import '../src/config';
import createOrGetConnection from '../src/db';

(async (): Promise<void> => {
  const createdAfterArgument = process.argv[2];

  if (!createdAfterArgument) {
    throw new Error('createdAfterDate argument is required');
  }

  const createdAfterDate = new Date(createdAfterArgument);

  if (Number.isNaN(createdAfterDate.getTime())) {
    throw new Error(
      'createdAfterDate argument is invalid, format should be ISO 6801',
    );
  }

  const con = await createOrGetConnection();

  await con.transaction(async (manager) => {
    await manager.query(
      `UPDATE post SET flags = flags || jsonb_build_object('sentAnalyticsReport', "sentAnalyticsReport", 'banned', "banned", 'deleted', "deleted", 'private', "private", 'visible', "visible", 'showOnFeed', "showOnFeed") WHERE "createdAt" > '${createdAfterDate.toISOString()}'`,
    );
  });

  process.exit();
})();
