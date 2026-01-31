import '../src/config';
import createOrGetConnection from '../src/db';
import { DatasetTool } from '../src/entity/dataset/DatasetTool';
import { fetchAndUploadToolIcon } from '../src/common/datasetTool';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async (): Promise<void> => {
  const dryRunArg = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  const con = await createOrGetConnection();

  console.log('Finding tools without icons...');

  const queryBuilder = con
    .getRepository(DatasetTool)
    .createQueryBuilder('tool')
    .where('tool.faviconSource = :source', { source: 'none' })
    .orderBy('tool.createdAt', 'ASC');

  if (limit) {
    queryBuilder.limit(limit);
  }

  const toolsWithoutIcons = await queryBuilder.getMany();

  console.log(`Found ${toolsWithoutIcons.length} tools without icons`);

  if (dryRunArg) {
    console.log('\nDry run mode - listing tools that would be processed:');
    for (const tool of toolsWithoutIcons) {
      console.log(`  - ${tool.title} (${tool.titleNormalized})`);
    }
    process.exit(0);
  }

  let successCount = 0;
  let failedCount = 0;

  for (const tool of toolsWithoutIcons) {
    try {
      const iconResult = await fetchAndUploadToolIcon(tool.id, tool.title);

      if (iconResult) {
        tool.faviconUrl = iconResult.url;
        tool.faviconSource = iconResult.source;
        await con.getRepository(DatasetTool).save(tool);
        console.log(
          `✓ Found icon for "${tool.title}" from ${iconResult.source}`,
        );
        successCount++;
      } else {
        console.log(`✗ No icon found for "${tool.title}"`);
        failedCount++;
      }
    } catch (err) {
      console.error(`✗ Error processing "${tool.title}":`, err);
      failedCount++;
    }

    // Rate limiting to avoid overwhelming external APIs
    await sleep(100);
  }

  console.log('\n--- Summary ---');
  console.log(`Total processed: ${toolsWithoutIcons.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Failed/No icon found: ${failedCount}`);

  process.exit(0);
})().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
