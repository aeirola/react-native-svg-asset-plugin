/* Inspired by
   https://github.com/facebook/metro/blob/v0.55.0/packages/metro/src/integration_tests/ */

const Metro = require('metro');
const path = require('path');

describe('react-native-svg-asset-plugin integration test', () => {
  jest.setTimeout(20 * 1000);

  it('returns svg assets as pngs', async () => {
    const config = await Metro.loadConfig({
      config: require.resolve('../metro.config.js'),
    });

    const result = await Metro.runBuild(config, {
      entry: 'TestBundle.js',
    });

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
});
