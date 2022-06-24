import { FastifyInstance } from 'fastify';
import {
  addNewPost,
  AddPostData,
  RejectPostData,
  Submission,
  SubmissionStatus,
} from '../entity';
import { getConnection } from 'typeorm';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: AddPostData }>('/newPost', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }
    const con = getConnection();
    const operationResult = await addNewPost(con, req.body);
    return res.status(200).send(operationResult);
  });
  fastify.post<{ Body: RejectPostData }>('/rejectPost', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const con = getConnection();
    const data = req.body;
    if (!data && !data?.submissionId) {
      return res
        .status(200)
        .send({ status: 'failed', reason: 'missing submission id' });
    }

    try {
      const repo = con.getRepository(Submission);
      const submission = await repo.findOne({ id: data.submissionId });
      if (submission.status === SubmissionStatus.Started) {
        await repo.save({ ...submission, status: SubmissionStatus.Rejected });
      }
      return res
        .status(200)
        .send({ status: 'ok', submissionId: data.submissionId });
    } catch (error) {
      throw error;
    }
  });
}
