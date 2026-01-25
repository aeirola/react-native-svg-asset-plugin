# react-native-svg-asset-plugin

Asset plugin for React Native which enables using SVGs with Image components. Works by generating PNGs during compile time, and passing them to the metro transformer.

:iphone: If you also want to use SVG images for your application launcher icons, you might want to check out [react-native-svg-app-icon](https://github.com/aeirola/react-native-svg-app-icon).

## Installation

### npm

```bash
npm install --save-dev react-native-svg-asset-plugin
```

No dependencies outside of NPM. Uses [sharp](https://github.com/lovell/sharp) for SVG rasterization.

Requires React Native version 0.57 (i.e. metro version 0.44) or later to work.

### metro

To enable the asset plugin you will need to include it in the metro configuration.

#### Expo

For expo projects you will first need to [enable customization](https://docs.expo.dev/guides/customizing-metro/) of the metro config:

```sh
npx expo customize metro.config.js
```

Then, in the `metro.config.js` file, add `'react-native-svg-asset-plugin'` to the transformer asset plugins like this:

```javascript
config.transformer.assetPlugins.push('react-native-svg-asset-plugin');
```

#### React Native

Add `'react-native-svg-asset-plugin'` to the list of `assetPlugins` in your `metro.config.js` file under the `transformer` section.

For example;

```javascript
module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
    assetPlugins: ['react-native-svg-asset-plugin'],
  },
};
```

### Usage

Just require your SVG files directly into React Native [Image](https://facebook.github.io/react-native/docs/image) and [ImageBackground](https://facebook.github.io/react-native/docs/imagebackground) components. For example:

```javascript
<Image source={require('./assets/image.svg')} />
```

Scaled PNGs will be generated under the symlink `.png-cache` alongside the SVG files, so you might want to add a `.gitignore` entry to exclude the cache symlink from your code repo.


### Configuration

You can configure the plugin behaviour through the optional `svgAssetPlugin` field in your `metro.config.js` file under the `transformer` section.

For example;

```javascript
module.exports = {
  transformer: {
    // ...
    assetPlugins: ['react-native-svg-asset-plugin'],
    svgAssetPlugin: {
      pngCacheDir: '.png-cache',
      scales: [1, 2, 3],
      output: {
        compressionLevel: 9,
      },
    },
  },
};
```

Where the possible configuration values are:

| Field              | Type     | Default        | Description                       |
|--------------------|----------|----------------|-----------------------------------|
| `cacheDir`         | string   | `'.png-cache'` | Name of symlink that will point to `cacheStorageDir`. |
| `cacheStorageDir`  | string   | OS temp        | Absolute path where generated PNGs are stored. Defaults to OS temp directory. |
| `scales`           | number[] | `[1, 2, 3]`    | PNG image scales to generate for different screen densities. |
| `output`           | object   | `{}`           | Sharp PNG output [options](http://sharp.pixelplumbing.com/en/v0.22.1/api-output/#png). |
| `ignoreRegex`      | RegExp   | `null`         | Regex that will be matched against the source file's full path, if there's a match the file will be ignored. |

You will need to reset the bundler cache with `react-native start --reset-cache` for configuration changes to take effect for already generated images.


## Comparison with react-native-svg

Most alternative ways of displaying SVG content in React Native apps are based on the [react-native-svg](https://github.com/react-native-community/react-native-svg) library, which provides runtime rendering of SVG images. react-native-svg-asset-plugin works differently by rasterizing the vector images to PNGs during compile time, and using the native image rendering APIs.

|                      |  react-native-svg  |  react-native-svg-asset-plugin  |
|----------------------|:------------------:|:-------------------------------:|
| Rasterization        |  Runtime           |  Compile time                   |
| Runtime dependencies |  JS + Native       |  None                           |
| Image compatibility  |  No                |  Yes                            |
| Remote assets        |  Yes               |  No                             |
| App size             |  Smaller           |  Larger                         |

## Troubleshooting

### Asset not found

```
Error: Asset not found: /Users/user/StickerSmash/assets/.png-cache/icon-423334598dc20172915d59bd4b95d059@3x.png for platform: ios
    at getAbsoluteAssetRecord (/Users/user/StickerSmash/node_modules/metro/src/Assets.js:129:11)
    at getAsset (/Users/user/StickerSmash/node_modules/metro/src/Assets.js:224:18)
    at Server._processSingleAssetRequest (/Users/user/StickerSmash/node_modules/metro/src/Server.js:436:20)
    at Server._processRequest (/Users/user/StickerSmash/node_modules/metro/src/Server.js:535:7)

```

In case the metro and plugin image caches are out of sync, the metro bundler may try to load images that aren't available anymore in the generated image cache. In this case you'll need to reset the metro cache to regenerate the images.

In case this happens frequently, you might want to create an issue about it in this repository.

## Technical details

The plugin works by intercepting loaded SVG assets, and transforming them to PNGs before they are loaded by the [metro transformer](https://facebook.github.io/metro/docs/en/concepts#transformation). After being loaded by the transformer, they work as any other PNG file in React Native, meaning you can use and style them freely in Image components.

Each SVG file produces three PNG files in 1x, 2x and 3x scales. The size of the PNG images are defined by the `width` and `height` attributes of the SVG images.

SVGs are rasterized to PNGs using the [sharp](https://github.com/lovell/sharp) Node.js library, which is based on [libvips](https://github.com/libvips/libvips) C library, which includes the [librsvg](https://github.com/GNOME/librsvg) library that renders the SVG images.

The generated assets need to be accessible from within the project directory in order to be served by the development server. Due to this we need to provide a symlink to the real temporary cache storage directory.
