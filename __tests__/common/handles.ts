import { ValidationError } from 'apollo-server-errors';
import { validateAndTransformHandle } from '../../src/common/handles';

describe('validateAndTransformHandle', () => {
  it('should return a too-short username error for 2-letter usernames', async () => {
    await expect(
      validateAndTransformHandle('ab', 'username', null as never),
    ).rejects.toEqual(
      new ValidationError(
        JSON.stringify({ username: 'username is too short' }),
      ),
    );
  });
});
