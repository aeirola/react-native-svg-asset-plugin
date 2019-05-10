/**
 * @flow strict-local
 */

const fse = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

import type { Metadata } from 'sharp';
import type { AssetData, AssetDataPlugin } from 'metro/src/Assets';

const cacheDirName = '.png-cache';

const imageScales = [
  { scale: 1, suffix: '' },
  { scale: 2, suffix: '@2x' },
  { scale: 3, suffix: '@3x' },
];

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

  const outputDirectory = path.join(assetData.fileSystemLocation, cacheDirName);
  const outputName = `${assetData.name}:${assetData.hash}`;

  const [imageData, _] = await Promise.all([
    readSvg(inputFilePath),
    fse.ensureDir(outputDirectory),
  ]);
  const outputImages = await Promise.all(
    imageScales.map(imageScale =>
      generatePng(
        imageData,
        imageScale.scale / inputFileScale,
        path.join(outputDirectory, `${outputName}${imageScale.suffix}.png`),
      ),
    ),
  );

  return {
    ...assetData,
    fileSystemLocation: outputDirectory,
    httpServerLocation: `${assetData.httpServerLocation}/${cacheDirName}`,
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
): Promise<OutputImage> {
  if (inputFile.metadata.density === undefined) {
    throw new Error('Input image missing density information');
  }
  const density = inputFile.metadata.density;

  const warmSharp = await asyncWarmSharp;
  await warmSharp(inputFile.buffer, {
    density: density * scale,
  })
    .png({
      adaptiveFiltering: false,
      compressionLevel: 9,
    })
    .toFile(outputFilePath);

  return {
    filePath: outputFilePath,
    scale: scale,
  };
}

const assetDataPlugin: AssetDataPlugin = reactNativeSvgAssetPlugin;
module.exports = assetDataPlugin;
