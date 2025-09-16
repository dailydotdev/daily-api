import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { MatchedCandidate } from '@dailydotdev/schema';
import createOrGetConnection from '../src/db';
import { User } from '../src/entity/user/User';
import { pubsub } from '../src/common/pubsub';

const ask = async (q: string) => {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(q);
    return answer.trim();
  } finally {
    rl.close();
  }
};

(async () => {
  console.log('Starting script...');
  const con = await createOrGetConnection();

  const usernameOrId =
    process.argv[2] || (await ask('Enter username or user ID: '));
  if (!usernameOrId) {
    console.error('Username or user ID is required.');
    process.exit(1);
  }

  const user = await con.getRepository(User).findOneOrFail({
    where: [{ id: usernameOrId }, { username: usernameOrId }],
  });

  await pubsub.topic('gondul.v1.candidate-opportunity-match').publishMessage({
    data: MatchedCandidate.fromJson({
      opportunityId: '89f3daff-d6bb-4652-8f9c-b9f7254c9af1',
      userId: user.id,
      matchScore: 0.87,
      reasoning:
        "We have noticed that you\'ve been digging into React performance optimization and exploring payment systems lately. Your skills in TypeScript and Node.js line up directly with the core technologies this team uses. You also follow several Atlassian engineers and have shown consistent interest in project management software, which makes this role a natural fit for your trajectory.",
      reasoningShort:
        'Your skills in TypeScript and Node.js line up directly with the core technologies this team uses.',
    }).toBinary(),
  });
  process.exit(0);
})();
