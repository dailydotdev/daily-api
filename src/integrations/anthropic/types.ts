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
  type: 'text';
  text: string;
  input: Record<string, unknown>;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface IAnthropicClient {
  garmr: IGarmrService;
  createMessage(request: AnthropicRequest): Promise<AnthropicResponse>;
}
