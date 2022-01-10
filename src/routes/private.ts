import { FastifyInstance } from 'fastify';
import { addNewPost, AddPostData } from '../entity';
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
}
