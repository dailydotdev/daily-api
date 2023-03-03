import { AgentOptions } from 'http';
import http from 'node:http';
import https from 'node:https';
import { RequestInit } from 'node-fetch';

const agentOpts: AgentOptions = { keepAlive: true, timeout: 1000 * 5 };
const httpAgent = new http.Agent(agentOpts);
const httpsAgent = new https.Agent(agentOpts);
export const fetchOptions: RequestInit = {
  agent: (_parsedURL) =>
    _parsedURL.protocol === 'http:' ? httpAgent : httpsAgent,
};
