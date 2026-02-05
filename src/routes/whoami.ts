import { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { executeGraphql } from './public/graphqlExecutor';

interface WhoamiUser {
  id: string;
  name: string;
  email: string;
  image: string;
  createdAt: string;
  company: string;
  username: string;
  bio: string;
  title: string;
  twitter: string;
  github: string;
  hashnode: string;
  roadmap: string;
  threads: string;
  codepen: string;
  reddit: string;
  stackoverflow: string;
  youtube: string;
  linkedin: string;
  mastodon: string;
  portfolio: string;
  infoConfirmed: boolean;
  timezone: string;
  reputation: number;
}

interface WhoamiResponse {
  whoami: WhoamiUser;
}

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      whoami {
        id
        name
        email
        image
        createdAt
        company
        username
        bio
        title
        twitter
        github
        hashnode
        roadmap
        threads
        codepen
        reddit
        stackoverflow
        youtube
        linkedin
        mastodon
        portfolio
        infoConfirmed
        timezone
        reputation
      }
    }`;

    return executeGraphql<WhoamiUser>(
      con,
      { query },
      (obj) => (obj as unknown as WhoamiResponse).whoami,
      req,
      res,
    );
  });
}
