import { IGarmrService } from '../garmr';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: AnthropicMessage[];
  [key: string]: unknown;
}

export interface AnthropicContentBlock {
  input: Record<string, unknown>;
}

export interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

export interface IAnthropicClient {
  garmr: IGarmrService;
  createMessage(request: AnthropicRequest): Promise<AnthropicResponse>;
}
