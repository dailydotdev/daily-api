import { setupServer } from 'msw/node';
import authHandlers from './auth';

export const MOCK_USER_ID = process.env.MOCK_USER_ID ?? '404';

export const checkIsMocking = () =>
  MOCK_USER_ID && process.env.NODE_ENV === 'development';

const mocks = setupServer(...authHandlers);

export { mocks };
