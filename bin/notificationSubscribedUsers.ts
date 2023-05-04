import { UserAction, UserActionType } from '../src/entity';
import createOrGetConnection from '../src/db';

const subscribedUsers = [];

(async () => {
  const con = await createOrGetConnection();
  const existing = await con
    .getRepository(UserAction)
    .findBy({ type: UserActionType.EnableNotification });

  await con
    .createQueryBuilder()
    .insert()
    .into(UserAction)
    .values(
      subscribedUsers
        .filter(
          (subscribedId) =>
            !existing.some(
              ({ userId: existingId }) => existingId === subscribedId,
            ),
        )
        .map((userId) => ({
          userId,
          type: UserActionType.EnableNotification,
        })),
    )
    .execute();
})();
