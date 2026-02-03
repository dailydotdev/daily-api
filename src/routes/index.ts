import { FastifyInstance } from 'fastify';

import rss from './rss';
import alerts from './alerts';
import redirector from './redirector';
import devcards from './devcards';
import privateRoutes from './private';
import whoami from './whoami';
import notifications from './notifications';
import boot from './boot';
import users from './users';
import redirects from './redirects';
import webhooks from './webhooks';
import localAds from './localAds';
import automations from './automations';
import sitemaps from './sitemaps';
import createOrGetConnection from '../db';
import { UserPersonalizedDigest, UserPersonalizedDigestType } from '../entity';
import { notifyGeneratePersonalizedDigest } from '../common';
import { PersonalizedDigestFeatureConfig } from '../growthbook';
import integrations from './integrations';
import gifs from './gifs';
import publicApi, { PUBLIC_API_PREFIX } from './public';
import { readFileSync } from 'fs';
import { join } from 'path';

const llmTxt = readFileSync(join(__dirname, 'llms.txt'), 'utf-8');

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.register(rss, { prefix: '/rss' });
  fastify.register(
    async (instance) => {
      await alerts(instance, con);
    },
    { prefix: '/alerts' },
  );
  fastify.register(
    async (instance) => {
      await notifications(instance, con);
    },
    { prefix: '/notifications' },
  );
  fastify.register(redirector, { prefix: '/r' });
  fastify.register(devcards, { prefix: '/devcards' });
  if (process.env.ENABLE_PRIVATE_ROUTES === 'true') {
    fastify.register(privateRoutes, { prefix: '/p' });
  }
  fastify.register(
    async (instance) => {
      await whoami(instance, con);
    },
    { prefix: '/whoami' },
  );
  fastify.register(boot, { prefix: '/boot' });
  fastify.register(boot, { prefix: '/new_boot' });
  fastify.register(users, { prefix: '/v1/users' });
  fastify.register(webhooks, { prefix: '/webhooks' });
  fastify.register(redirects);
  fastify.register(automations, { prefix: '/auto' });
  fastify.register(sitemaps, { prefix: '/sitemaps' });
  fastify.register(integrations, { prefix: '/integrations' });
  fastify.register(gifs, { prefix: '/gifs' });

  // Public API v1
  fastify.register(
    async (instance) => {
      await publicApi(instance, con);
    },
    { prefix: PUBLIC_API_PREFIX },
  );

  fastify.get('/robots.txt', (req, res) => {
    return res.type('text/plain').send(`User-agent: *
Allow: /devcards/
Allow: /graphql
Allow: /boot
Disallow: /`);
  });

  fastify.get('/llms.txt', (req, res) => {
    return res.type('text/plain').send(llmTxt);
  });

  fastify.get('/v1/auth/authorize', async (req, res) => {
    return res.type('text/plain').send(
      `Firefox has recently changed their approval process and in their wisdom have set us back to a 2022 version of the daily.dev extension.
You can follow the discussion here.
https://x.com/dailydotdev/status/1798960336667893866

In the interim we suggest using the web version.
https://app.daily.dev`,
    );
  });

  if (process.env.NODE_ENV === 'development') {
    fastify.register(localAds);
  }

  fastify.get('/id', (req, res) => {
    return res.status(200).send(req.userId);
  });

  // Debugging endpoint
  fastify.post('/e', (req, res) => {
    req.log.debug({ body: req.body }, 'events received');
    return res.status(204).send();
  });

  fastify.post('/e/x', (req, res) => {
    req.log.debug({ body: req.body }, 'allocation received');
    return res.status(204).send();
  });

  fastify.post<{
    Body: {
      userIds: string[];
      config?: PersonalizedDigestFeatureConfig;
      type?: UserPersonalizedDigestType;
    };
  }>('/digest/send', async (req, res) => {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      authorization !== `Bearer ${process.env.PERSONALIZED_DIGEST_SECRET}`
    ) {
      return res.status(401).send({
        message: 'unauthorized',
      });
    }

    const userCountLimit = 100;
    res.header('content-type', 'application/json');

    const { userIds, config, type } = req.body || {};
    const digestType = type ?? UserPersonalizedDigestType.Digest;

    if (!Array.isArray(userIds)) {
      return res.status(400).send({ message: 'userIds must be an array' });
    }

    if (userIds.length > userCountLimit) {
      return res.status(400).send({
        message: `too many userIds`,
      });
    }

    const timestamp = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const previousDate = new Date(timestamp - oneWeek);

    await Promise.allSettled(
      userIds.map(async (userId) => {
        const con = await createOrGetConnection();
        const personalizedDigest = await con
          .getRepository(UserPersonalizedDigest)
          .findOneBy({ userId, type: digestType });

        if (!personalizedDigest) {
          return;
        }

        await notifyGeneratePersonalizedDigest({
          log: req.log,
          personalizedDigest,
          emailSendTimestamp: timestamp,
          previousSendTimestamp: previousDate.getTime(),
          deduplicate: false,
          config,
        });
      }),
    );

    return res.status(201).send({
      message: 'ok',
    });
  });

  if (process.env.NODE_ENV === 'development') {
    // dummy endpoint for development purposes
    fastify.post('/api/user/briefing', async (req, res) => {
      return res.status(200).send({
        sections: [
          {
            title: 'Must know',
            items: [
              {
                title: 'OpenAI and Microsoft are fighting',
                body: "OpenAI is reportedly considering an antitrust complaint against Microsoft, their primary investor. The conflict stems from Microsoft's control over OpenAI's cloud hosting and approval rights for structural changes, including OpenAI's shift to a public-benefit corporation. OpenAI is also exploring partnerships with Google Cloud and resisting Microsoft's access to IP from its recent acquisition, Windsurf, signaling a deepening rift in their high-profile AI collaboration.",
              },
              {
                title: 'Google Cloud had a bad day',
                body: "A global Google Cloud Platform outage on June 12, 2025, disrupted major services like Gmail, Spotify, and Cloudflare for hours. The root cause was a null pointer exception in Google's Service Control API, triggered by a malformed policy change that propagated globally via Spanner. Google identified the issue quickly but recovery was delayed by a 'thundering herd' effect, highlighting systemic risks of single cloud provider dependency.",
              },
              {
                title: 'AI is making people redundant',
                body: 'Amazon CEO Andy Jassy announced further job cuts due to AI efficiency, urging employees to retrain or risk redundancy. The World Economic Forum projects 40% of automatable roles will be cut, and BT Group CEO anticipates deeper layoffs. New York state now requires disclosure when AI is a primary cause of layoffs, as over 22,000 tech workers have been laid off industry-wide in 2025, driven by AI automation and cost reduction.',
              },
              {
                title: 'Open source maintainers are fed up',
                body: 'Nick Wellnhofer, sole maintainer of the critical libxml2 library, ended support for embargoed security reports, citing the unsustainable burden of unpaid volunteer work. This widely used XML parsing library underpins infrastructure for tech giants like Apple and Google, who benefit from coordinated disclosure without compensating maintainers. His decision highlights a systemic sustainability failure in open source security, risking slower or public vulnerability disclosures.',
              },
              {
                title: 'AI agents are a security nightmare',
                body: "Salesforce researchers found their AI agents mishandle sensitive data, with only 58% success on single-step CRM tasks. A security researcher exploited an LLM chatbot to access unauthorized customer data via prompt injection, and LangChain's platform had a critical vulnerability allowing OpenAI API key theft. These incidents highlight that giving AI agents access to private data, untrusted content, and external communication creates a 'lethal trifecta' risk, as current AI safety guardrails are unreliable.",
              },
            ],
          },
          {
            title: 'Good to know',
            items: [
              {
                title: "AMD is coming for NVIDIA's AI crown",
                body: "AMD is positioning its new ZEN 6 architecture and MI350/MI355X GPUs to challenge NVIDIA's AI dominance, claiming superior performance per dollar, with OpenAI publicly announcing intent to adopt AMD's new GPU tech.",
              },
              {
                title: 'Google launches new Gemini models',
                body: 'Google officially released Gemini 2.5 Pro and Flash models, along with a new Flash-Lite variant, featuring up to 1 million token context length and a simplified, tiered pricing structure.',
              },
              {
                title: 'AWS beefs up security',
                body: 'AWS re:Inforce 2025 announced mandatory MFA for all root users, new Security Hub features for centralized risk management, and enhanced GuardDuty for EKS clusters, emphasizing a commitment to CISA Secure by Design principles.',
              },
              {
                title: 'Microsoft launches sovereign cloud for Europe',
                body: 'Microsoft introduced Microsoft 365 Local, an on-premises version of its productivity suite for European customers, designed to meet EU data sovereignty and compliance requirements like GDPR, with features like Data Guardian.',
              },
              {
                title: 'Waymo expands robotaxi service',
                body: 'Waymo expanded its robotaxi service by 80 square miles across Los Angeles and the San Francisco Bay Area, now offering over 250,000 paid trips weekly despite recent vandalism incidents.',
              },
              {
                title: 'Malicious PyPI package targets developers',
                body: "A malicious Python package, 'chimera-sandbox-extensions,' was found on PyPI, designed to steal AWS credentials, CI/CD secrets, and Kubernetes configs, using sophisticated C2 and obfuscation techniques.",
              },
              {
                title: 'Figma acquires Payload CMS',
                body: 'Figma acquired Payload CMS, an open-source headless CMS, to bridge design and code workflows, enabling designers to add React-based interactivity to Figma Sites using AI prompts and code layers.',
              },
              {
                title: 'Threads gets Fediverse feed',
                body: "Meta's Threads now offers a dedicated opt-in feed for ActivityPub content and improved profile search for Fediverse users, marking its most prominent integration with the open social web to date.",
              },
              {
                title: 'Discord is working on Windows on Arm app',
                body: 'Discord is developing a native Windows on Arm version of its communication app, with an early development build available, to address performance issues on Qualcomm-powered Copilot Plus devices.',
              },
              {
                title: 'WordPress core updates',
                body: 'WordPress core development is planning a 6.8.2 maintenance release to address bugs, with ongoing performance initiatives focusing on optimizations like static variables for in-memory caching.',
              },
            ],
          },
          {
            title: 'Bullshit police',
            items: [
              {
                title: 'AI is making you dumber, says science',
                body: "A new study using EEG brain monitoring claims students relying on ChatGPT for essays show 'significantly weaker neural connectivity' and 'reduced cognitive engagement.' Apparently, using AI for writing leads to 'cognitive debt' and a 'reduced sense of essay ownership.' So, if you're feeling detached from your work, blame the bots, not your lack of sleep.",
              },
              {
                title: 'AI will solve all your DevOps problems',
                body: "Salesforce launched OpsAI Agent to orchestrate AI for incident resolution, while Neubird's Hawkeye promises to interpret telemetry data for incident diagnosis. Both claim to reduce resolution times and knowledge discovery, but neither is fully autonomous. So, you still need humans, but now they get to watch AI 'think' for several minutes before giving them a recommendation. Progress!",
              },
              {
                title: 'AI is making everything more expensive',
                body: "Enterprise cloud spending is through the roof, with AI inference costs causing 'unpredictable usage-based pricing' and 'cost overruns up to 500-1000%.' Salesforce is hiking prices by 6% for 'expanded AI integration,' and their new AI agents cost $125-550/month, despite their own research showing only a 58% success rate. Seems like the 'AI premium' is mostly for the vendors, not for actual performance.",
              },
            ],
          },
        ],
        brief_statistics: {
          posts: 236,
          sources: 97,
          saved_time: 79860,
        },
        source_ids: [
          'addy',
          'k8s',
          'flutter',
          'gatsby',
          'golang',
          'dev_channel',
          'newsvue',
          'next',
          'nodejs',
          'php',
          'python',
          'ala',
          'react_native',
          'rust',
          'scotch',
          'ts',
          'cleancoder',
          'alligator',
          'svelte',
          'react',
        ],
        reading_time: 262,
      });
    });
  }
}
