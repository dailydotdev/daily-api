import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import { Product, ProductType } from '../../entity/Product';
import { ContributionFoundingContributor } from '../../entity/contribution/ContributionFoundingContributor';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../entity/user/UserTransaction';
import { transferCores } from '../njord';
import { systemUser } from '../utils';

export const CONTRIBUTION_FOUNDING_LIMIT = 1000;

export const CONTRIBUTION_FOUNDING_AWARD_PRODUCT_ID =
  '3bbe8325-ceb9-411b-be83-ffba2703ce82';

// Grants the founding-contributor award (a Product award paid by the system),
// called from the claimContributionFoundingAward mutation once a user has at
// least one approved contribution, while the campaign is under the cap.
// Idempotent per user via the founding-contributor PK; the whole grant is
// transactional, so a failed Cores transfer rolls back the reservation and
// retries cleanly. The cap is best-effort under concurrency (a small overshoot
// is acceptable).
export const grantFoundingContributorAward = async ({
  con,
  userId,
  limit = CONTRIBUTION_FOUNDING_LIMIT,
  productId = CONTRIBUTION_FOUNDING_AWARD_PRODUCT_ID,
}: {
  con: DataSource;
  userId: string;
  limit?: number;
  productId?: string;
}): Promise<boolean> => {
  return con.transaction(async (manager) => {
    const foundingRepo = manager.getRepository(ContributionFoundingContributor);

    if ((await foundingRepo.count()) >= limit) {
      return false;
    }

    const product = await manager.getRepository(Product).findOne({
      select: ['id', 'value'],
      where: { id: productId, type: ProductType.Award },
    });
    if (!product) {
      return false;
    }

    const transactionId = randomUUID();
    // RETURNING reflects ON CONFLICT DO NOTHING: empty when the user is already a
    // founding contributor. `identifiers` is unreliable here because the PK is
    // provided (not generated), so it echoes the input even on a no-op insert.
    const reservation = await foundingRepo
      .createQueryBuilder()
      .insert()
      .values({ userId, transactionId })
      .orIgnore()
      .returning(['userId'])
      .execute();

    if (!reservation.raw.length) {
      return false;
    }

    const transaction = await manager.getRepository(UserTransaction).save(
      manager.getRepository(UserTransaction).create({
        id: transactionId,
        processor: UserTransactionProcessor.Njord,
        receiverId: userId,
        status: UserTransactionStatus.Success,
        productId: product.id,
        senderId: systemUser.id,
        value: product.value,
        valueIncFees: product.value,
        fee: 0,
        request: {},
        flags: { note: 'Founding contributor award' },
        referenceId: userId,
        referenceType: UserTransactionType.User,
      }),
    );

    await transferCores({
      ctx: { userId },
      transaction,
      entityManager: manager,
    });

    return true;
  });
};
