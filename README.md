# react-native-svg-asset-plugin

[![Build Status](https://travis-ci.org/aeirola/react-native-svg-asset-plugin.svg?branch=master)](https://travis-ci.org/aeirola/react-native-svg-asset-plugin)

Asset plugin for React Native which enables using SVGs with Image components. Works by generating PNGs during compile time, and passing them to the metro transformer.

:iphone: If you also want to use SVG images for your application launcher icons, you might want to check out [react-native-svg-app-icon](https://github.com/aeirola/react-native-svg-app-icon).

## Installation

### npm

```bash
npm install --save-dev react-native-svg-asset-plugin
```

No dependencies outside of NPM. Uses [sharp](https://github.com/lovell/sharp) for SVG rasterization.

Requires React Native version 0.57 or later to work. Expo not supported, instead you might want to use [react-native-svg-transformer](https://github.com/kristerkari/react-native-svg-transformer).

### metro

Add `'react-native-svg-asset-plugin'` to the list of `assetPlugins` in your `metro.config.js` file under the `transformer` section.

For example;

```javascript
module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
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

Scaled PNGs will be generated under the subdirectory `.png-cache` alongside the SVG files, so you might want to add a `.gitignore` entry to exclude the cache directory from your code repo.


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

| Field         | Type     | Default        | Description                       |
|---------------|----------|----------------|-----------------------------------|
| `cacheDir`    | string   | `'.png-cache'` | Name of directory to store cached PNGs. |
| `scales`      | number[] | `[1, 2, 3]`    | PNG image scales to generate for different screen densities. |
| `output`      | object   | `{}`           | Sharp PNG output [options](http://sharp.pixelplumbing.com/en/v0.22.1/api-output/#png). |
| `ignoreRegex` | RegExp   | `null`         | Regex that will be matched against the source file's full path, if there's a match the file will be ignored. |

You will need to reset the bundler cache with `react-native start --reset-cache` for configuration changes to take effect for already generated images.


## Comparison with react-native-svg

Most alternative ways of displaying SVG content in React Native apps are based on the [react-native-svg](https://github.com/react-native-community/react-native-svg) library, which provides runtime rendering of SVG images. react-native-svg-asset-plugin works differently by rasetrizing the vector images to PNGs during compile time, and using the native image rendering APIs.

|                      |  react-native-svg  |  react-native-svg-asset-plugin  |
|----------------------|:------------------:|:-------------------------------:|
| Rasterization        |  Runtime           |  Compile time                   |
| Runtime dependencies |  JS + Native       |  None                           |
| Image compatibility  |  No                |  Yes                            |
| Remote assets        |  Yes               |  No                             |
| App size             |  Smaller           |  Larger                         |


## Technical details

The plugin works by intercepting loaded SVG assets, and transforming them to PNGs before they are loaded by the [metro transformer](https://facebook.github.io/metro/docs/en/concepts#transformation). After being loaded by the transformer, they work as any other PNG file in React Native, meaning you can use and style them freely in Image components.

Each SVG file produces three PNG files in 1x, 2x and 3x scales. The size of the PNG images are defined by the `width` and `height` attributes of the SVG images.

SVGs are rasterized to PNGs using the [sharp](https://github.com/lovell/sharp) Node.js library, which is based on [libvips](https://github.com/libvips/libvips) C library, which includes the [librsvg](https://github.com/GNOME/librsvg) library that renders the SVG images.
