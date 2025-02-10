import { FastifyInstance } from 'fastify';
import { Post, User, UserAction } from '../entity';
import createOrGetConnection from '../db';
import { ValidationError } from 'apollo-server-errors';
import { validateAndTransformHandle } from '../common/handles';
import type {
  AddUserDataPost,
  UpdateUserEmailData,
} from '../entity/user/utils';
import { addNewUser, updateUserEmail } from '../entity/user/utils';

interface SearchUsername {
  search: string;
}

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: AddUserDataPost }>('/newUser', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const con = await createOrGetConnection();
    // Temporary fix to migrate existing "referral" to "referralId" for backward compatability
    const { referral, ...rest } = req.body || ({} as AddUserDataPost);
    const referralId = rest.referralId || referral;
    let referralOrigin = rest.referralOrigin;

    // Temporary fix to set referralOrigin to "squad" for backward compatability
    if (referralId && !referralOrigin) {
      referralOrigin = 'squad';
    }

    const body = { ...rest, referralId, referralOrigin };
    const operationResult = await addNewUser(con, body, req);
    return res.status(200).send(operationResult);
  });
  fastify.post<{ Body: UpdateUserEmailData }>(
    '/updateUserEmail',
    async (req, res) => {
      if (!req.service) {
        return res.status(404).send();
      }

      const con = await createOrGetConnection();
      const operationResult = await updateUserEmail(con, req.body, req.log);
      return res.status(200).send(operationResult);
    },
  );
  fastify.get<{ Querystring: SearchUsername }>(
    '/checkUsername',
    async (req, res) => {
      if (!req.service) {
        return res.status(404).send();
      }

      const { search } = req.query;

      if (!search) {
        return res.status(400).send();
      }

      const con = await createOrGetConnection();
      try {
        const handle = await validateAndTransformHandle(
          search,
          'username',
          con,
        );
        const user = await con
          .getRepository(User)
          .findOneBy({ username: handle });
        return res.status(200).send({ isTaken: !!user });
      } catch (err) {
        if (err instanceof ValidationError) {
          return res.status(200).send({ isTaken: true });
        }
        throw err;
      }
    },
  );
  fastify.get<{
    Params: {
      id: string;
    };
    Body: Pick<Post, 'id'> & {
      resourceLocation?: string;
    };
  }>('/posts/:id', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();

    const post = await con.getRepository(Post).findOne({
      select: ['id', 'contentMeta'],
      where: { id },
    });

    if (!post) {
      return res.status(404).send();
    }

    return res.status(200).send({
      id: post.id,
      resourceLocation: (
        post.contentMeta as {
          cleaned?: { resource_location?: string }[];
        }
      )?.cleaned?.[0]?.resource_location,
      scrapedResourceLocation: (
        post.contentMeta as {
          scraped?: { resource_location?: string };
        }
      )?.scraped?.resource_location,
    });
  });
  fastify.get<{
    Params: {
      user_id: string;
      action_name: string;
    };
    Body: {
      found: boolean;
      completedAt?: string;
    };
  }>('/actions/:user_id/:action_name', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { user_id, action_name } = req.params;
    if (!user_id || !action_name) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();

    const action = await con.getRepository(UserAction).findOne({
      select: ['completedAt'],
      where: { userId: user_id, type: action_name },
    });

    return res.status(200).send({
      found: !!action,
      completedAt: action?.completedAt,
    });
  });
}
