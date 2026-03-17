import '../src/config';
import { parseArgs } from 'node:util';
import { uploadLogoFromUrl } from '../src/common/cloudinary';
import createOrGetConnection from '../src/db';
import { Source } from '../src/entity';

const start = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      'source-id': { type: 'string', short: 's' },
      url: { type: 'string', short: 'u' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const sourceId = values['source-id'];
  const url = values.url;

  if (!sourceId) {
    throw new Error('--source-id (-s) is required');
  }

  if (!url) {
    throw new Error('--url (-u) is required');
  }

  console.log('Preparing Cloudinary upload...');
  console.log({
    sourceId,
    url,
    uploadPreset: 'source',
    deliveryTransformation:
      'svg => c_limit,w_256,f_png then f_auto,q_auto; raster => f_auto,q_auto',
  });

  if (values['dry-run']) {
    return;
  }

  const deliveryUrl = await uploadLogoFromUrl(sourceId, url);

  console.log('\nUpload result');
  console.log({ deliveryUrl });

  const con = await createOrGetConnection();
  const result = await con
    .getRepository(Source)
    .update({ id: sourceId }, { image: deliveryUrl });

  if (!result.affected) {
    console.warn(`Source "${sourceId}" not found in database`);
  } else {
    console.log(`Updated source "${sourceId}" image in database`);
  }
};

start()
  .then(() => {
    console.log('done');
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });
