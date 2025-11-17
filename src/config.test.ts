import { describe, it, expect } from 'vitest';
import * as config from './config';

describe('config', () => {
  it('contains a reasonable last modified time', async () => {
    const loadedConfig = await config.load();

    expect(loadedConfig.lastModifiedTime).toBeGreaterThan(1590000000000);
  });
});
