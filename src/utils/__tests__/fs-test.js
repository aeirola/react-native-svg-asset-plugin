/**
 * @flow
 */

const path = require('path');

const fsUtils = require('../fs');

describe('fsUtils', () => {
  const testfilePath = path.join(__dirname, 'testfile');
  const nonexistingFilePath = path.join(__dirname, 'non-existent-file');

  describe('getLastModifiedTime', () => {
    it('returns millisecond time for existing files', async () => {
      expect(await fsUtils.getLastModifiedTime(testfilePath)).toBeGreaterThan(
        1590000000000,
      );
    });

    it('returns 0 on nonexisting files', async () => {
      expect(await fsUtils.getLastModifiedTime(nonexistingFilePath)).toBe(0);
    });
  });

  describe('updateLastModifiedTime', () => {
    it('updates modified time of existing files', async () => {
      const currentTime = Date.now();
      await fsUtils.updateLastModifiedTime(testfilePath);

      const modifiedTime = await fsUtils.getLastModifiedTime(testfilePath);
      expect(modifiedTime).toBeGreaterThan(currentTime - 5000);
      expect(modifiedTime).toBeLessThan(currentTime + 5000);
    });

    it('does not fail on unexisting files', async () => {
      await fsUtils.updateLastModifiedTime(nonexistingFilePath);
    });
  });
});
