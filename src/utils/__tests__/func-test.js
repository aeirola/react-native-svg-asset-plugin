/**
 * @flow
 */

const funcUtils = require('../func');

describe('funcUtils', () => {
  describe('memo', () => {
    it('always returns the same value', async () => {
      const memoizedFunction = funcUtils.memo(async () => ({}));

      expect(await memoizedFunction()).toBe(await memoizedFunction());
    });

    it('only calls the callback function once', async () => {
      const callbackFunction = jest.fn(async () => ({}));
      const memoizedFunction = funcUtils.memo(callbackFunction);

      memoizedFunction();
      memoizedFunction();
      memoizedFunction();

      expect(callbackFunction).toHaveBeenCalledTimes(1);
    });

    it('does not call callback until return function is called', async () => {
      const callbackFunction = jest.fn();

      const memoizedFunction = funcUtils.memo(callbackFunction);

      expect(callbackFunction).not.toHaveBeenCalled();

      memoizedFunction();

      expect(callbackFunction).toHaveBeenCalledTimes(1);
    });
  });
});
