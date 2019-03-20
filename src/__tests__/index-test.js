/**
 * @flow
 */

const path = require('path');
const sharp = require('sharp');

const assetPlugin = require('../index');

describe('react-native-svg-asset-plugin', () => {
  const imageDir = path.join(__dirname, 'images');
  const baseSvgAsset = {
    __packager_asset: true,
    fileSystemLocation: imageDir,
    httpServerLocation: '/assets/images',
    width: undefined,
    height: undefined,
    hash: '0123456789abcdef0123456789abcdef',
    type: 'svg',
  };

  const outputDir = path.join(imageDir, '.png-cache');
  const basePngAsset = {
    __packager_asset: true,
    fileSystemLocation: outputDir,
    httpServerLocation: '/assets/images/.png-cache',
    hash: '0123456789abcdef0123456789abcdef',
    type: 'png',
  };

  it('converts SVG assets to scaled PNG assets', async () => {
    const pngAsset = await assetPlugin({
      ...baseSvgAsset,
      scales: [1],
      files: [path.join(imageDir, 'red-200x100.svg')],
      name: 'red-200x100',
    });

    const outputFileName = 'red-200x100:0123456789abcdef0123456789abcdef';
    expect(pngAsset).toEqual({
      ...basePngAsset,
      width: 200,
      height: 100,
      scales: [1, 2, 3],
      files: [
        path.join(outputDir, `${outputFileName}.png`),
        path.join(outputDir, `${outputFileName}@2x.png`),
        path.join(outputDir, `${outputFileName}@3x.png`),
      ],
      name: outputFileName,
    });

    await expect(
      getImageColor(path.join(outputDir, `${outputFileName}.png`)),
    ).resolves.toEqual('red');

    await expect(
      getImageSize(path.join(outputDir, `${outputFileName}.png`)),
    ).resolves.toEqual({
      width: 200,
      height: 100,
    });
    await expect(
      getImageSize(path.join(outputDir, `${outputFileName}@2x.png`)),
    ).resolves.toEqual({
      width: 200 * 2,
      height: 100 * 2,
    });
    await expect(
      getImageSize(path.join(outputDir, `${outputFileName}@3x.png`)),
    ).resolves.toEqual({
      width: 200 * 3,
      height: 100 * 3,
    });
  });

  it('fails on missing images', () => {
    const pngAsset = assetPlugin({
      ...baseSvgAsset,
      scales: [1],
      files: [path.join(imageDir, 'nonexistent.svg')],
      name: 'nonexistent',
    });

    return expect(pngAsset).rejects.toThrow(
      /^ENOENT: no such file or directory/,
    );
  });

  it('fails when passed empty scales', () => {
    const pngAsset = assetPlugin({
      ...baseSvgAsset,
      scales: [],
      files: [],
      name: 'red-200x100',
    });

    return expect(pngAsset).rejects.toThrow('No files passed.');
  });

  it('fails when passed multiple scales', () => {
    const pngAsset = assetPlugin({
      ...baseSvgAsset,
      scales: [1, 2, 3],
      files: [
        path.join(imageDir, 'red-200x100.svg'),
        path.join(imageDir, 'red-200x100.svg'),
        path.join(imageDir, 'red-200x100.svg'),
      ],
      name: 'red-200x100',
    });

    return expect(pngAsset).rejects.toThrow(
      'Multiple SVG scales not supported.',
    );
  });

  it('fails when passed scale is not 1', () => {
    const pngAsset = assetPlugin({
      ...baseSvgAsset,
      scales: [0.5],
      files: [path.join(imageDir, 'red-200x100.svg')],
      name: 'red-200x100',
    });

    return expect(pngAsset).rejects.toThrow('Scaled SVGs not supported.');
  });
});

async function getImageColor(
  imagePath: string,
): Promise<'red' | 'green' | 'blue' | 'unknown'> {
  const stats = await sharp(imagePath).stats();
  if (stats.channels[0].mean === 255) {
    return 'red';
  } else if (stats.channels[1].mean === 255) {
    return 'green';
  } else if (stats.channels[2].mean === 255) {
    return 'blue';
  } else {
    return 'unknown';
  }
}

async function getImageSize(
  imagePath: string,
): Promise<{
  width: ?number,
  height: ?number,
}> {
  const metadata = await sharp(imagePath).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
  };
}
