import { AbortError, asyncRetry } from '../../src/integrations/retry';

describe('asyncRetry', () => {
  it('should call the function once', async () => {
    const fn = jest.fn();
    await asyncRetry(fn, { retries: 5 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call the function until it succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');
    const result = await asyncRetry(fn, { retries: 5 });
    expect(result).toEqual('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should abort on TypeError', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new TypeError('fail'));
    await expect(asyncRetry(fn, { retries: 5 })).rejects.toThrow(TypeError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should abort on AbortError and throw the original error', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new AbortError(new Error('fail')));
    await expect(asyncRetry(fn, { retries: 5 })).rejects.toThrow(Error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw the last error after max retries', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'));
    await expect(asyncRetry(fn, { retries: 1 })).rejects.toThrow(Error);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
