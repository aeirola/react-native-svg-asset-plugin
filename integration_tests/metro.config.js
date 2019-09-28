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
