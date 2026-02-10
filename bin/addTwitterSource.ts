import '../src/config';
import createOrGetConnection from '../src/db';
import { MachineSource } from '../src/entity/Source';
import { uploadLogo } from '../src/common/cloudinary';
import { pubsub } from '../src/common/pubsub';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { parseArgs } from 'node:util';

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

const fetchTwitterProfile = async (username: string): Promise<TwitterUser> => {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error('TWITTER_BEARER_TOKEN env var is required');
  }

  const url = `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=profile_image_url,name`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { data?: TwitterUser; errors?: unknown[] };
  if (!json.data) {
    throw new Error(
      `Twitter user not found: ${username} - ${JSON.stringify(json.errors)}`,
    );
  }

  return json.data;
};

const downloadAvatar = async (avatarUrl: string): Promise<Readable> => {
  // Use 400x400 version for higher quality
  const url = avatarUrl.replace('_normal', '_400x400');
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download avatar: ${res.status}`);
  }

  return Readable.fromWeb(res.body as import('stream/web').ReadableStream);
};

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
    const stream = await downloadAvatar(profile.profile_image_url);
    const name = uuidv4().replace(/-/g, '');
    imageUrl = await uploadLogo(name, stream);
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
