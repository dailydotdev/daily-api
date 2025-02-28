import { v4 as uuidv4 } from 'uuid';

export const generateAppAccountToken = (): string => {
  return uuidv4();
};
