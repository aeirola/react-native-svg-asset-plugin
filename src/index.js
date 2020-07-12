/**
 * @flow strict-local
 */

const fse = require('fs-extra');
const path = require('path');

import type { Metadata, PngOptions } from 'sharp';
import type { AssetData, AssetDataPlugin } from 'metro/src/Assets';

const cache = require('./cache');
const config = require('./config');
const sharp = require('./sharp');
const funcUtils = require('./utils/func');
const fsUtils = require('./utils/fs');

import type { Config } from './config';

const asyncConfig: Promise<Config> = config.load();

async function reactNativeSvgAssetPlugin(
  assetData: AssetData,
): Promise<AssetData> {
  const filePath = assetData.files.length ? assetData.files[0] : '';
  if (await shouldConvertFile(assetData, filePath)) {
    return convertSvg(assetData);
  } else {
    return assetData;
  }
}

async function shouldConvertFile(
  assetData: AssetData,
  filePath: string,
): Promise<boolean> {
  if (assetData.type !== 'svg') {
    return false;
  }

  const ignoreRegex = (await asyncConfig).ignoreRegex;
  if (ignoreRegex && ignoreRegex.test(filePath)) {
    return false;
  }

  return true;
}

async function convertSvg(assetData: AssetData): Promise<AssetData> {
  if (assetData.scales.length !== assetData.files.length) {
    throw new Error("Passed scales doesn't match passed files.");
  } else if (assetData.files.length === 0) {
    throw new Error('No files passed.');
  } else if (assetData.files.length > 1) {
    throw new Error('Multiple SVG scales not supported.');
  } else if (assetData.scales[0] !== 1) {
    throw new Error('Scaled SVGs not supported.');
  }

  const inputFilePath = assetData.files[0];
  const inputFileScale = assetData.scales[0];

  const config = await asyncConfig;
  const outputDirectory = path.join(
    assetData.fileSystemLocation,
    config.cacheDir,
  );
  const outputName = `${assetData.name}-${assetData.hash}`;

  await fse.ensureDir(outputDirectory);
  const imageLoader = createimageLoader(inputFilePath);
  const outputImages = await Promise.all(
    config.scales.map((imageScale) =>
      ensurePngUpToDate(
        imageLoader,
        imageScale / inputFileScale,
        path.join(
          outputDirectory,
          `${outputName}${getScaleSuffix(imageScale)}.png`,
        ),
        config.output,
      ),
    ),
  );

  return {
    ...assetData,
    fileSystemLocation: outputDirectory,
    httpServerLocation: `${assetData.httpServerLocation}/${config.cacheDir}`,
    files: outputImages.map((outputImage) => outputImage.filePath),
    scales: outputImages.map((outputImage) => outputImage.scale),
    name: outputName,
    type: 'png',
  };
}

type InputImageLoader = () => Promise<InputImage>;

interface InputImage {
  buffer: Buffer;
  metadata: Metadata;
}

interface OutputImage {
  filePath: string;
  scale: number;
}

/**
 * Creates an image loader for input file.
 * This provides lazy cached loading of image data.
 */
function createimageLoader(inputFilePath: string): InputImageLoader {
  return funcUtils.memo(async () => {
    const [fileBuffer, loadedSharp] = await Promise.all([
      fse.readFile(inputFilePath),
      sharp.load(),
    ]);

    const metadata = await loadedSharp(fileBuffer).metadata();

    return {
      buffer: fileBuffer,
      metadata: metadata,
    };
  });
}

/**
 * Ensures that the resultign PNG file exists on the fileystem.
 *
 * In case the file does not exist yet, or it is older than the
 * current configuration, it will be generated.
 *
 * Otherwise the existing file will be left in place, and its
 * last modified time will be updated.
 */
async function ensurePngUpToDate(
  imageLoader: InputImageLoader,
  scale: number,
  outputFilePath: string,
  outputOptions: PngOptions,
): Promise<OutputImage> {
  if (await cache.isFileOutdated(outputFilePath, await asyncConfig)) {
    const inputFile = await imageLoader();
    await generatePng(inputFile, scale, outputFilePath, outputOptions);
  } else {
    await fsUtils.updateLastModifiedTime(outputFilePath);
  }

  return {
    filePath: outputFilePath,
    scale: scale,
  };
}

/**
 * Generates a PNG file from a loaded SVG file.
 */
async function generatePng(
  inputFile: InputImage,
  scale: number,
  outputFilePath: string,
  outputOptions: PngOptions,
): Promise<void> {
  if (inputFile.metadata.density === undefined) {
    throw new Error('Input image missing density information');
  }
  const density = inputFile.metadata.density;

  const loadedSharp = await sharp.load();
  await loadedSharp(inputFile.buffer, {
    density: density * scale,
  })
    .png(outputOptions)
    .toFile(outputFilePath);
}

function getScaleSuffix(scale: number): string {
  switch (scale) {
    case 1:
      return '';
    default:
      return `@${scale}x`;
  }
}

const assetDataPlugin: AssetDataPlugin = reactNativeSvgAssetPlugin;
module.exports = assetDataPlugin;
