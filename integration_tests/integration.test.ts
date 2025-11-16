/* Inspired by
   https://github.com/facebook/metro/blob/v0.55.0/packages/metro/src/integration_tests/ */

import { describe, it, expect } from 'vitest';

import * as metro from 'metro';

describe(
  'react-native-svg-asset-plugin integration test',
  { timeout: 20 * 1000 },
  () => {
    it('returns svg assets as pngs', async () => {
      const config = await metro.loadConfig({
        config: require.resolve('./metro.config.js'),
      });

      const result = (await metro.runBuild(config, {
        entry: 'TestBundle.js',
      })) as unknown as { code: string };

      const output = eval(result.code);
      expect(output).toMatchObject({
        image: {
          width: 100,
          height: 100,
          scales: [1, 2, 3],
          type: 'png',
        },
      });
    });
  },
);
