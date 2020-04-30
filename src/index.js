/**
 * @flow strict-local
 */

const fse = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ignore = require('ignore');

import type { Metadata, PngOptions } from 'sharp';
import type { AssetData, AssetDataPlugin } from 'metro/src/Assets';

declare interface Config {
  cacheDir: string;
  scales: number[];
  output: PngOptions;
  ignorePatterns: string[];
  includePatterns: string[];
}

declare interface Ignore {
  ignores: string => boolean;
}

const defaultConfig: Config = {
  cacheDir: '.png-cache',
  scales: [1, 2, 3],
  output: {},
  ignorePatterns: [],
  includePatterns: [],
};

const config: Config = loadConfig();

function loadConfig(): Config {
  let metroConfig;
  try {
    metroConfig = require(path.join(process.cwd(), 'metro.config.js'));
  } catch {
    metroConfig = {};
  }

  const transformerOptions = metroConfig.transformer || {};
  const svgAssetPluginOptions = transformerOptions.svgAssetPlugin || {};

  const config = {
    ...defaultConfig,
    ...svgAssetPluginOptions,
  };

  const hasIgnore = config.ignorePatterns && config.ignorePatterns.length;
  const hasInclude = config.includePatterns && config.includePatterns.length;
  if (hasIgnore && hasInclude) {
    throw new Error(
      'Invalid configuration: ignorePatterns and includePatterns cannot be used together.',
    );
  }

  return config;
}

const ig: Ignore = createIgnore();

function createIgnore(): Ignore {
  const _ig = ignore();
  function makeRelative(absolutePath) {
    return path.relative(process.cwd(), absolutePath);
  }

  if (config.ignorePatterns.length) {
    _ig.add(config.ignorePatterns);
    return {
      ignores(path) {
        return _ig.ignores(makeRelative(path));
      },
    };
  } else if (config.includePatterns.length) {
    _ig.add(config.includePatterns);
    return {
      ignores(path) {
        return !_ig.ignores(makeRelative(path));
      },
    };
  } else {
    return {
      ignores(path) {
        return false;
      },
    };
  }
}

// First run might cause a xmllib error, run safe warmup
// See https://github.com/lovell/sharp/issues/1593
async function warmupSharp(sharp: typeof sharp): Promise<typeof sharp> {
  try {
    await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" /></svg>`,
        'utf-8',
      ),
    ).metadata();
  } catch {}

  return sharp;
}

const asyncWarmSharp = warmupSharp(sharp);

async function reactNativeSvgAssetPlugin(
  assetData: AssetData,
): Promise<AssetData> {
  if (assetData.type === 'svg') {
    return convertSvg(assetData);
  } else {
    return assetData;
  }
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

  if (ig.ignores(inputFilePath)) {
    return assetData;
  }

  const outputDirectory = path.join(
    assetData.fileSystemLocation,
    config.cacheDir,
  );
  const outputName = `${assetData.name}-${assetData.hash}`;

  const [imageData, _] = await Promise.all([
    readSvg(inputFilePath),
    fse.ensureDir(outputDirectory),
  ]);
  const outputImages = await Promise.all(
    config.scales.map(imageScale =>
      generatePng(
        imageData,
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
    width: imageData.metadata.width,
    height: imageData.metadata.height,
    files: outputImages.map(outputImage => outputImage.filePath),
    scales: outputImages.map(outputImage => outputImage.scale),
    name: outputName,
    type: 'png',
  };
}

interface InputImage {
  buffer: Buffer;
  metadata: Metadata;
}

interface OutputImage {
  filePath: string;
  scale: number;
}

async function readSvg(inputFilePath: string): Promise<InputImage> {
  const fileBuffer = await fse.readFile(inputFilePath);
  const warmSharp = await asyncWarmSharp;
  const metadata = await warmSharp(fileBuffer).metadata();

  return {
    buffer: fileBuffer,
    metadata: metadata,
  };
}

async function generatePng(
  inputFile: InputImage,
  scale: number,
  outputFilePath: string,
  outputOptions: PngOptions,
): Promise<OutputImage> {
  if (inputFile.metadata.density === undefined) {
    throw new Error('Input image missing density information');
  }
  const density = inputFile.metadata.density;

  const warmSharp = await asyncWarmSharp;
  await warmSharp(inputFile.buffer, {
    density: density * scale,
  })
    .png(outputOptions)
    .toFile(outputFilePath);

  return {
    filePath: outputFilePath,
    scale: scale,
  };
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
