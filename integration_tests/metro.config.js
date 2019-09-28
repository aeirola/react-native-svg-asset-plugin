const path = require('path');

const ROOT_PATH = path.resolve(__dirname, 'bundles');

module.exports = {
  cacheStores: [],
  maxWorkers: 1,
  projectRoot: ROOT_PATH,
  reporter: { update() {} },
  watchFolders: [
    ROOT_PATH,
    path.resolve(__dirname, '..', 'node_modules', 'metro', 'src'),
  ],
  resolver: {
    useWatchman: false,
    // Workaround for https://github.com/facebook/metro/issues/453
    blacklistRE: /(node_modules[\/\\]react[\/\\]dist[\/\\].*)|(website\/node_modules\/.*)|(heapCapture\/bundle\.js)|(.*\/__tests__\/.*)/,
  },
  transformer: {
    assetPlugins: [path.resolve(__dirname, '..', 'src')],
    assetRegistryPath: path.resolve(
      __dirname,
      '..',
      'node_modules',
      'metro',
      'src',
      'integration_tests',
      'basic_bundle',
      'AssetRegistry',
    ),
    enableBabelRCLookup: false,
    enableBabelRuntime: false,
  },
};
