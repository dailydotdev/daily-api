import { getFirstName, ghostUser } from '../common';
import { TypedWorker } from './worker';
import { cio, dateToCioTimestamp } from '../cio';
import { User } from '../entity';

function camelCaseToSnakeCase(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const snakeObj: Record<string, unknown> = {};
  for (const key in obj) {
    snakeObj[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] =
      obj[key];
  }
  return snakeObj;
}

const OMIT_FIELDS: (keyof User)[] = [
  'id',
  'bio',
  'devcardEligible',
  'readme',
  'readmeHtml',
  'infoConfirmed',
  'profileConfirmed',
  'notificationEmail',
];

const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-cio',
  handler: async (message, con, log) => {
    const {
      data: { newProfile: user },
    } = message;

    const id = user.id;
    if (id === ghostUser.id || !user.infoConfirmed) {
      return;
    }

    for (const field of OMIT_FIELDS) {
      delete user[field];
    }

    await cio.identify(id, {
      ...camelCaseToSnakeCase(user),
      first_name: getFirstName(user.name),
      created_at: dateToCioTimestamp(new Date(user.createdAt)),
      updated_at: dateToCioTimestamp(new Date(user.updatedAt)),
    });
    log.info({ userId: user.id }, 'updated user profile in customerio');
  },
};

export default worker;
