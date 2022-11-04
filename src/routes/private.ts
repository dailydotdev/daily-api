import { FastifyInstance } from 'fastify';
import {
  addNewPost,
  addNewUser,
  AddPostData,
  AddUserData,
  RejectPostData,
  Submission,
  SubmissionStatus,
  updateUserEmail,
  UpdateUserEmailData,
  User,
} from '../entity';
import { SubmissionFailErrorKeys, SubmissionFailErrorMessage } from '../errors';
import createOrGetConnection from '../db';

interface SearchUsername {
  search: string;
}

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: AddPostData }>('/newPost', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }
    const con = await createOrGetConnection();
    const operationResult = await addNewPost(con, req.body, req.log);
    return res.status(200).send(operationResult);
  });
  fastify.post<{ Body: RejectPostData }>('/rejectPost', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const con = await createOrGetConnection();
    const data = req.body;
    if (!data && !data?.submissionId) {
      return res
        .status(200)
        .send({ status: 'failed', reason: 'missing submission id' });
    }

    try {
      const repo = con.getRepository(Submission);
      const submission = await repo.findOneBy({ id: data.submissionId });
      if (submission.status === SubmissionStatus.Started) {
        await repo.save({
          ...submission,
          status: SubmissionStatus.Rejected,
          reason:
            data?.reason in SubmissionFailErrorMessage
              ? <SubmissionFailErrorKeys>data?.reason
              : 'GENERIC_ERROR',
        });
      }
      return res
        .status(200)
        .send({ status: 'ok', submissionId: data.submissionId });
    } catch (error) {
      throw error;
    }
  });
  fastify.post<{ Body: AddUserData }>('/newUser', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const con = await createOrGetConnection();
    const operationResult = await addNewUser(con, req.body, req.log);
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
