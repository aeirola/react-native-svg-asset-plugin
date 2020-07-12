/**
 * @flow strict-local
 */

const path = require('path');

import type { PngOptions } from 'sharp';

const fsUtils = require('./utils/fs');

export interface Config {
  cacheDir: string;
  scales: number[];
  output: PngOptions;
  +ignoreRegex: ?RegExp;
  lastModifiedTime: number;
}

const defaultConfig: Config = {
  cacheDir: '.png-cache',
  scales: [1, 2, 3],
  output: {},
  ignoreRegex: null,
  lastModifiedTime: 0,
};

export async function load(): Promise<Config> {
  const metroConfigPath = path.join(process.cwd(), 'metro.config.js');

  const lastModifiedTime = Math.max(
    ...(await Promise.all([
      fsUtils.getLastModifiedTime(metroConfigPath),
      fsUtils.getLastModifiedTime(__filename),
    ])),
  );

  let metroConfig;
  try {
    metroConfig = require(metroConfigPath);
  } catch {
    metroConfig = {};
  }

  const transformerOptions = metroConfig.transformer || {};
  const svgAssetPluginOptions = transformerOptions.svgAssetPlugin || {};

  const config = {
    ...defaultConfig,
    ...svgAssetPluginOptions,
    lastModifiedTime,
  };

  return config;
}
