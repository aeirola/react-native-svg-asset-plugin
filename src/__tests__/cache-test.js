/**
 * @flow
 */

const path = require('path');

const cache = require('../cache');
const fsUtils = require('../utils/fs');

describe('cache', () => {
  const testfilePath = path.join(__dirname, 'testfile');
  const nonexistingFilePath = path.join(__dirname, 'non-existent-file');
  const config = {
    cacheDir: '.png-cache',
    scales: [1, 2, 3],
    output: {},
    ignoreRegex: null,
    lastModifiedTime: Date.now(),
  };

  describe('isFileOutdated', () => {
    it('returns true for old files', async () => {
      await fsUtils.updateLastModifiedTime(testfilePath);

      expect(
        await cache.isFileOutdated(testfilePath, {
          ...config,
          lastModifiedTime: Date.now() + 10 * 1000,
        }),
      ).toBe(true);
    });

    it('returns false for new files', async () => {
      await fsUtils.updateLastModifiedTime(testfilePath);

      expect(
        await cache.isFileOutdated(testfilePath, {
          ...config,
          lastModifiedTime: Date.now() - 10 * 1000,
        }),
      ).toBe(false);
    });

    it('returns true for missing files', async () => {
      expect(await cache.isFileOutdated(nonexistingFilePath, config)).toBe(
        true,
      );
    });
  });
});
