/**
 * @flow
 */

const config = require('../config');

describe('config', () => {
  it('contains a reasonable last modified time', async () => {
    const loadedConfig = await config.load();

    expect(await loadedConfig.lastModifiedTime).toBeGreaterThan(1590000000000);
  });
});
