import { Alerts, ALERTS_DEFAULT, Post, UserActionType } from '../entity';
import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { DataSource } from 'typeorm';
import { insertOrIgnoreAction } from './actions';
import { GQLEmptyResponse } from './common';

interface GQLAlerts {
  filter: boolean;
}

interface GQLUpdateAlertsInput extends Partial<GQLAlerts> {
  filter?: boolean;
  myFeed?: string;
}

export const typeDefs = /* GraphQL */ `
  """
  Alerts to display to the relevant user
  """
  type Alerts {
    """
    Status to display for filter red dot
    """
    filter: Boolean!

    """
    Date last seen of the rank achievement popup
    """
    rankLastSeen: DateTime

    """
    Wether to show the my feed alert (migrated/created/null)
    migrated: The user has existing filters so we created myFeed for them
    created: The user applied filters himself
    null: The user clicked to not show the alert anymore
    """
    myFeed: String

    """
    Wether to show the companion helper
    Default = true, meaning yes show it
    Once the user has seen it once, we set this value to false
    """
    companionHelper: Boolean!

    """
    Date of the last changelog user saw
    """
    lastChangelog: DateTime

    """
    Date of the last banner user saw
    """
    lastBanner: DateTime

    """
    Whether to show the squad tour and sync across devices
    """
    squadTour: Boolean!

    """
    Whether to show the referral prompt
    """
    showGenericReferral: Boolean!
  }

  input UpdateAlertsInput {
    """
    Status to display for filter red dot
    """
    filter: Boolean

    """
    Date last seen of the rank achievement popup
    """
    rankLastSeen: DateTime

    """
    Status for the My Feed alert
    """
    myFeed: String

    """
    Status to display for companion helper
    """
    companionHelper: Boolean

    """
    Date of the last changelog user saw
    """
    lastChangelog: DateTime

    """
    Date of the last banner user saw
    """
    lastBanner: DateTime

    """
    Whether to show the squad tour and sync across devices
    """
    squadTour: Boolean
  }

  extend type Mutation {
    """
    Update the alerts for user
    """
    updateUserAlerts(data: UpdateAlertsInput!): Alerts! @auth

    """
    Update the last referral reminder
    """
    updateLastReferralReminder: EmptyResponse! @auth
  }

  extend type Query {
    """
    Get the alerts for user
    """
    userAlerts: Alerts!
  }
`;

/**
 * Remove the flags from the alerts object
 * @param alerts
 */
export const saveReturnAlerts = (alerts: Alerts) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { flags, ...data } = alerts;
  return data;
};

export const updateAlerts = async (
  con: DataSource,
  userId: string,
  data: GQLUpdateAlertsInput & { showGenericReferral?: boolean },
  flags?: Alerts['flags'],
): Promise<GQLAlerts> => {
  const repo = con.getRepository(Alerts);
  const alerts = await repo.findOneBy({ userId });

  if (data.filter === false) {
    await insertOrIgnoreAction(con, userId, UserActionType.MyFeed);
  }

  if (!alerts) {
    return saveReturnAlerts(
      await repo.save({
        userId,
        ...data,
        flags: { ...flags, lastReferralReminder: new Date() },
      }),
    );
  }

  return saveReturnAlerts(
    await repo.save({
      ...alerts,
      ...data,
      flags: { ...alerts.flags, lastReferralReminder: new Date() },
    }),
  );
};

export const getAlerts = async (
  con: DataSource,
  userId: string,
): Promise<Omit<Alerts, 'flags'>> => {
  const alerts = await con.getRepository(Alerts).findOneBy({
    userId,
  });
  if (alerts) {
    return saveReturnAlerts(alerts);
  }
  return ALERTS_DEFAULT as Alerts;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    updateUserAlerts: async (
      _,
      { data }: { data: GQLUpdateAlertsInput },
      ctx,
    ): Promise<GQLAlerts> => updateAlerts(ctx.con, ctx.userId, data),
    updateLastReferralReminder: async (
      _,
      __,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await updateAlerts(
        ctx.con,
        ctx.userId,
        {
          showGenericReferral: false,
        },
        { lastReferralReminder: new Date() },
      );
      return;
    },
  },
  Query: {
    userAlerts: (_, __, ctx): Promise<GQLAlerts> | GQLAlerts =>
      getAlerts(ctx.con, ctx.userId),
  },
});
