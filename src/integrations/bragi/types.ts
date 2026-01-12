import {
  ParseFeedbackRequest,
  ParseFeedbackResponse,
} from '@dailydotdev/schema';

export interface IBragiClient {
  parseFeedback(request: ParseFeedbackRequest): Promise<ParseFeedbackResponse>;
}
