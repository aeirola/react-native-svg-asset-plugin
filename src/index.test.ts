import { describe, it as baseIt, expect } from 'vitest';

import fse from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

import assetPlugin from './index';

describe('react-native-svg-asset-plugin', { timeout: 20 * 1000 }, () => {
  const it = baseIt.extend<{
    imageDir: string,
  }>({
    imageDir: async ({}, use) => {
      const tmpDir = await fse.mkdtemp('react-native-svg-asset-plugin');
      const testfilePath = path.join(tmpDir, 'red-200x100.svg');
      await fse.writeFile(
        testfilePath,
        `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="red" />
        </svg>`,
      );

      await use(tmpDir);

      await fse.remove(tmpDir);
    },
  });

  const baseSvgAsset = {
    __packager_asset: true,
    httpServerLocation: '/assets/images',
    width: 200,
    height: 100,
    hash: '0123456789abcdef0123456789abcdef',
    type: 'svg',
  };

  const basePngAsset = {
    __packager_asset: true,
    httpServerLocation: '/assets/images/.png-cache',
    hash: '0123456789abcdef0123456789abcdef',
    type: 'png',
  };

  it('converts SVG assets to scaled PNG assets', async ({ imageDir }) => {
    const pngAsset = await assetPlugin({
      ...baseSvgAsset,
      fileSystemLocation: imageDir,
      scales: [1],
      files: [path.join(imageDir, 'red-200x100.svg')],
      name: 'red-200x100',
    });

    const outputDir = path.join(imageDir, '.png-cache');
    const outputFileName = 'red-200x100-0123456789abcdef0123456789abcdef';
    expect(pngAsset).toEqual({
      ...basePngAsset,
      fileSystemLocation: outputDir,
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

    expect(
      await getImageColor(path.join(outputDir, `${outputFileName}.png`)),
    ).toEqual('red');

    expect(
      await getImageSize(path.join(outputDir, `${outputFileName}.png`)),
    ).toEqual({
      width: 200,
      height: 100,
    });
    expect(
      await getImageSize(path.join(outputDir, `${outputFileName}@2x.png`)),
    ).toEqual({
      width: 200 * 2,
      height: 100 * 2,
    });
    expect(
      await getImageSize(path.join(outputDir, `${outputFileName}@3x.png`)),
    ).toEqual({
      width: 200 * 3,
      height: 100 * 3,
    });
  });

  it('fails on missing images', async ({ imageDir }) => {
    await expect(
      assetPlugin({
        ...baseSvgAsset,
        fileSystemLocation: imageDir,
        scales: [1],
        files: [path.join(imageDir, 'nonexistent.svg')],
        name: 'nonexistent',
      }),
    ).rejects.toThrow(/^ENOENT: no such file or directory/);
  });

  it('fails when passed empty scales', async ({ imageDir }) => {
    await expect(
      assetPlugin({
        ...baseSvgAsset,
        fileSystemLocation: imageDir,
        scales: [],
        files: [],
        name: 'red-200x100',
      }),
    ).rejects.toThrow('No files passed.');
  });

  it('fails when passed multiple scales', async ({ imageDir }) => {
    await expect(
      assetPlugin({
        ...baseSvgAsset,
        fileSystemLocation: imageDir,
        scales: [1, 2, 3],
        files: [
          path.join(imageDir, 'red-200x100.svg'),
          path.join(imageDir, 'red-200x100.svg'),
          path.join(imageDir, 'red-200x100.svg'),
        ],
        name: 'red-200x100',
      }),
    ).rejects.toThrow('Multiple SVG scales not supported.');
  });

  it('fails when passed scale is not 1', async ({ imageDir }) => {
    await expect(
      assetPlugin({
        ...baseSvgAsset,
        fileSystemLocation: imageDir,
        scales: [0.5],
        files: [path.join(imageDir, 'red-200x100.svg')],
        name: 'red-200x100',
      }),
    ).rejects.toThrow('Scaled SVGs not supported.');
  });
});

async function getImageColor(
  imagePath: string,
): Promise<'red' | 'green' | 'blue' | 'unknown'> {
  const stats = await sharp(imagePath).stats();
  if (stats.channels[0]?.mean === 255) {
    return 'red';
  } else if (stats.channels[1]?.mean === 255) {
    return 'green';
  } else if (stats.channels[2]?.mean === 255) {
    return 'blue';
  } else {
    return 'unknown';
  }
}

async function getImageSize(imagePath: string): Promise<{
  width?: number,
  height?: number,
}> {
  const metadata = await sharp(imagePath).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
  };
}
