import { setupServer } from 'msw/node';
import authHandlers from './auth';

const mocks = setupServer(...authHandlers);

export { mocks };
