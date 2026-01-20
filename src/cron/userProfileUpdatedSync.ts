import { subHours } from 'date-fns';
import { Cron } from './cron';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { In, MoreThan } from 'typeorm';
import { processStream } from '../common/streaming';
import { logger } from '../logger';
import { getSecondsTimestamp, triggerTypedEvent } from '../common';
import {
  UserProfile,
  UserProfileUpdatedMessage,
  UserExperience as UserExperienceMessage,
  UserExperienceType as UserExperienceTypeProto,
  Location,
} from '@dailydotdev/schema';
import { Readable } from 'node:stream';
import type { UserExperienceEducation } from '../entity/user/experiences/UserExperienceEducation';
import type { UserExperienceProject } from '../entity/user/experiences/UserExperienceProject';
import type { UserExperienceWork } from '../entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../entity/user/experiences/types';
import { queryReadReplica } from '../common/queryReadReplica';

const mapExperienceTypeToProto: Record<
  UserExperienceType,
  UserExperienceTypeProto
> = {
  [UserExperienceType.Work]: UserExperienceTypeProto.WORK,
  [UserExperienceType.Education]: UserExperienceTypeProto.EDUCATION,
  [UserExperienceType.Project]: UserExperienceTypeProto.PROJECT,
  [UserExperienceType.Certification]: UserExperienceTypeProto.CERTIFICATION,
  [UserExperienceType.Volunteering]: UserExperienceTypeProto.VOLUNTEERING,
  [UserExperienceType.OpenSource]: UserExperienceTypeProto.OPENSOURCE,
};

export const userProfileUpdatedSync: Cron = {
  name: 'user-profile-updated-sync',
  handler: async (con) => {
    const timeThreshold = subHours(new Date(), 3);

    const userExperiences = await queryReadReplica(
      con,
      async ({ queryRunner }) => {
        const changedUserProfiles: Pick<UserExperience, 'userId'>[] =
          await queryRunner.manager.getRepository(UserExperience).find({
            select: ['userId'],
            where: {
              updatedAt: MoreThan(timeThreshold),
            },
            relations: {
              skills: true,
              company: true,
              location: true,
            },
          });

        // get all experiences for the changed user profiles so we can send full profile updates
        const userExperiences = await queryReadReplica(
          con,
          async ({ queryRunner }) => {
            return queryRunner.manager.getRepository(UserExperience).find({
              where: {
                userId: In(
                  changedUserProfiles.map((profile) => profile.userId),
                ),
              },
              relations: {
                skills: true,
                company: true,
                location: true,
              },
            });
          },
        );

        return userExperiences;
      },
    );

    const experiencesByUser = new Map<string, UserExperience[]>();

    for (const experience of userExperiences) {
      let userExperiences = experiencesByUser.get(experience.userId);

      if (!userExperiences) {
        userExperiences = [];

        experiencesByUser.set(experience.userId, userExperiences);
      }

      userExperiences.push(experience);
    }

    await processStream<UserExperience[]>(
      Readable.from(experiencesByUser.values()),
      async (experiences) => {
        if (experiences.length === 0) {
          return;
        }

        const userId = experiences[0].userId;

        const userProfileMessage = new UserProfileUpdatedMessage({
          profile: new UserProfile({
            userId,
            experiences: await Promise.all(
              experiences.map(async (experience) => {
                const experienceLocation =
                  (await experience.location) || experience.customLocation;

                return new UserExperienceMessage({
                  id: experience.id,
                  type: mapExperienceTypeToProto[experience.type],
                  companyName:
                    (await experience.company)?.name ||
                    experience.customCompanyName ||
                    undefined,
                  title: experience.title,
                  subtitle: experience.subtitle || undefined,
                  description: experience.description || undefined,
                  startedAt: getSecondsTimestamp(experience.startedAt),
                  endedAt: experience.endedAt
                    ? getSecondsTimestamp(experience.endedAt)
                    : undefined,
                  location: experienceLocation
                    ? new Location({
                        city: experienceLocation.city || undefined,
                        country: experienceLocation.country || undefined,
                        subdivision:
                          experienceLocation.subdivision || undefined,
                      })
                    : undefined,
                  locationType: experience.locationType || undefined,
                  createdAt: getSecondsTimestamp(experience.createdAt),
                  updatedAt: getSecondsTimestamp(experience.updatedAt),
                  url: (experience as UserExperienceProject).url || undefined,
                  grade:
                    (experience as UserExperienceEducation).grade || undefined,
                  employmentType:
                    (experience as UserExperienceWork).employmentType ||
                    undefined,
                  verified: (experience as UserExperienceWork).verified,
                });
              }),
            ),
            skills: (
              await Promise.all(experiences.map((exp) => exp.skills))
            ).flatMap((skills) => {
              return skills;
            }),
          }),
        });

        await triggerTypedEvent(
          logger,
          'api.v1.user-profile-updated',
          userProfileMessage,
        );
      },
      10,
    );

    logger.info(
      { profiles: experiencesByUser.size, experiences: userExperiences.length },
      'user profile updated sync completed',
    );
  },
};
