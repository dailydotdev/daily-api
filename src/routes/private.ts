import { FastifyInstance } from 'fastify';
import {
  addNewUser,
  AddUserDataPost,
  updateUserEmail,
  UpdateUserEmailData,
  User,
} from '../entity';
import createOrGetConnection from '../db';

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
    const body = { ...rest, referralId: rest.referralId || referral };
    const operationResult = await addNewUser(con, body, req.log);
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
      const user = await con
        .getRepository(User)
        .findOneBy({ username: search });
      return res.status(200).send({ isTaken: !!user });
    },
  );
}
