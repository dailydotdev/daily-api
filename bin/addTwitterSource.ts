import '../src/config';
import createOrGetConnection from '../src/db';
import { MachineSource } from '../src/entity/Source';
import { uploadLogo } from '../src/common/cloudinary';
import { pubsub } from '../src/common/pubsub';
import { parseArgs } from 'node:util';
import {
  downloadTwitterProfileImage,
  fetchTwitterProfile,
} from '../src/integrations/twitter/profile';

const start = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      username: { type: 'string', short: 'u' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const username = values.username;
  if (!username) {
    throw new Error('--username (-u) is required');
  }
  const dryRun = values['dry-run'];

  console.log(`Fetching Twitter profile for @${username}...`);
  const profile = await fetchTwitterProfile(username);
  console.log(`Found: ${profile.name} (@${profile.username})`);

  let imageUrl: string | undefined;
  if (profile.profile_image_url) {
    console.log('Downloading avatar and uploading to Cloudinary...');
    const stream = await downloadTwitterProfileImage(profile.profile_image_url);
    imageUrl = await uploadLogo(username.toLowerCase(), stream);
    console.log(`Uploaded avatar: ${imageUrl}`);
  } else {
    console.log('No avatar found, skipping Cloudinary upload');
  }

  if (dryRun) {
    console.log('\n--- DRY RUN ---');
    console.log('Would create MachineSource:', {
      id: username.toLowerCase(),
      handle: username.toLowerCase(),
      name: profile.name,
      twitter: profile.username,
      image: imageUrl,
    });
    console.log('Would publish to source-added:', {
      url: `https://x.com/${profile.username}`,
      source_id: username.toLowerCase(),
      engine_id: 'twitter:account',
      status: 'processing',
      options: {
        twitter_account: { username: profile.username },
        audience_fit: { threshold: 0.4 },
      },
    });
    return;
  }

  const con = await createOrGetConnection();

  console.log('Creating MachineSource in DB...');
  const sourceData: Partial<MachineSource> = {
    id: username.toLowerCase(),
    handle: username.toLowerCase(),
    name: profile.name,
    twitter: profile.username,
  };
  if (imageUrl) {
    sourceData.image = imageUrl;
  }
  await con.getRepository(MachineSource).save(sourceData);
  console.log(`Created source: ${sourceData.id}`);

  console.log('Publishing to source-added topic...');
  const message = {
    url: `https://x.com/${profile.username}`,
    source_id: username.toLowerCase(),
    engine_id: 'twitter:account',
    status: 'processing',
    options: {
      twitter_account: {
        username: profile.username,
      },
      audience_fit: {
        threshold: 0.4,
      },
    },
  };
  await pubsub.topic('source-added').publishMessage({ json: message });
  console.log('Published source-added message');
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
