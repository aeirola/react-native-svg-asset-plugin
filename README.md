<img src="logo.svg" alt="react-native-svg-asset-plugin" />

# react-native-svg-asset-plugin

Allows you to use SVG images directly in React Native and Expo, similarly to how you would use PNG files. This is useful for projects working with SVG icons, and don't want to manually keep generating PNG versions of them.

:iphone: If you also want to use SVG images for your application launcher icons, you might want to check out [react-native-svg-app-icon](https://github.com/aeirola/react-native-svg-app-icon).

## Quick start

1. Install
    ```sh
    npm install -D react-native-svg-asset-plugin
    ```

2. Add metro config
   ```javascript
   // metro.config.js
   config.transformer.assetPlugins.push("react-native-svg-asset-plugin");
   ```

3. Import images
    ```jsx
    // Logo.jsx
    import { Image, View } from "react-native";

    const Logo = () =>
      <View>
        <Image source={require('./icons/logo.svg')} />
      </View>
    ```

## Comparison

Instead of rendering SVG images while running the app, like [react-native-svg](https://github.com/react-native-community/react-native-svg) and [expo-image](https://docs.expo.dev/versions/latest/sdk/image/), react-native-svg-asset-plugin produces PNG files during app build time which are then bundled with the application.

This makes react-native-svg-asset-plugin useful for occasional smaller UI icons, as it doesn't require bundling a complete SVG rendering engine in the app. On the other hand react-native-svg and expo-image are more useful when you have a lot of larger images, or need to load SVG images dynamically at runtime.

|                      |  react-native-svg       |  expo-image             |  react-native-svg-asset-plugin  |
|----------------------|:-----------------------:|:-----------------------:|:-------------------------------:|
| Rendering            |  Runtime                |  Runtime                |  Build time                     |
| Runtime dependencies |  JS + Native            |  JS + Native            |  None                           |
| Dependency size      |  Larger                 |  Larger                 |  None                           |
| Image size           |  Smaller                |  Smaller                |  Larger                         |
| Works with `<Image>` |  No                     |  Partially              |  Yes                            |
| Remote assets        |  Yes                    |  Yes                    |  No                             |
| Modifiable           |  Yes                    |  No                     |  No                             |
| Suitable for         |  Many / external images |  Expo SDK projects      | UI icons                        |

## Installation

### npm

```bash
npm install --save-dev react-native-svg-asset-plugin
```

No dependencies outside of NPM. Uses [sharp](https://github.com/lovell/sharp) for SVG rasterization.

### metro

To enable the asset plugin you will need to include it in the metro bundler configuration.

#### Expo

For expo projects you will first need to [enable customization](https://docs.expo.dev/guides/customizing-metro/) of the metro config:

```sh
npx expo customize metro.config.js
```

Then, in the `metro.config.js` file, add `"react-native-svg-asset-plugin"` to the transformer asset plugins like this:

```javascript
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.transformer.assetPlugins.push("react-native-svg-asset-plugin");

module.exports = config;
```

#### React Native

Add `'react-native-svg-asset-plugin'` to the list of `assetPlugins` in your `metro.config.js` file under the `transformer` section.

For example;

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    assetPlugins: ['react-native-svg-asset-plugin'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

### git

Add `.png-cache` to your `.gitignore` file so that the generated files won't be added to your repository.

## Usage

Require your SVG files directly into React Native [Image](https://reactnative.dev/docs/image) or [ImageBackground](https://reactnative.dev/docs/imagebackground) components. For example:

```jsx
import { Image, View } from "react-native";

const Logo = () =>
  <View>
    <Image source={require('./icons/logo.svg')} />
  </View>
```

While most valid SVG files are supported, for best results include `width` and `height` properties for the `<svg>` element to ensure that the PNG images are reasonably sized. Additionally, you'll want to avoid `<text>` elements that might produce different results based on what fonts are installed. For complete information about supported SVG features, see the [`librsvg` documentation](https://gnome.pages.gitlab.gnome.org/librsvg/devel-docs/features.html).

Scaled PNGs will be generated under the `.png-cache` symlink alongside the SVG files. The asset plugin then directs React Native to load the PNG files instead of the SVG.

```
- icons/
  - .png-cache/ (symlink to temp cache storage)
    - logo-<hash>@1x.png
    - logo-<hash>@2x.png
    - logo-<hash>@3x.png
  - logo.svg
```


## Configuration

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


## Troubleshooting

### Asset not found

```
Error: Asset not found: /Users/user/StickerSmash/assets/.png-cache/icon-423334598dc20172915d59bd4b95d059@3x.png for platform: ios
```

In case the metro and plugin image caches are out of sync, the metro bundler may try to load images that aren't available anymore in the generated image cache. In this case you'll need to reset the metro cache to regenerate the images.

In case this happens frequently, you might want to create an issue about it in this repository.

## Technical details

The plugin works by intercepting loaded SVG assets, and transforming them to PNGs before they are loaded by the [metro transformer](https://metrobundler.dev/docs/concepts#transformation). After being loaded by the transformer, they work as any other PNG file in React Native, meaning you can use and style them freely in Image components.

Each SVG file produces three PNG files in 1x, 2x and 3x scales. The size of the PNG images are defined by the `width` and `height` attributes of the SVG images.

SVGs are rasterized to PNGs using the [sharp](https://github.com/lovell/sharp) Node.js library, which is based on [libvips](https://github.com/libvips/libvips) C library, which includes the [librsvg](https://github.com/GNOME/librsvg) library that renders the SVG images.

The generated assets need to be accessible from within the project directory in order to be served by the development server. Due to this we need to provide a symlink to the real temporary cache storage directory.
