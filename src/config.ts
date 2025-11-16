import path from 'path';
import type { PngOptions } from 'sharp';
import * as fsUtils from './utils/fs';
import { MetroConfig } from 'metro';

export interface Config {
  cacheDir: string;
  scales: number[];
  output: PngOptions;
  ignoreRegex: RegExp | null;
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

  let metroConfig: MetroConfig & {
    transformer?: MetroConfig['transformer'] & { svgAssetPlugin?: Config },
  };
  try {
    metroConfig = require(metroConfigPath);
  } catch {
    metroConfig = {};
  }

  const transformerOptions = metroConfig.transformer || {};
  const svgAssetPluginOptions = transformerOptions.svgAssetPlugin || {};

  const config: Config = {
    ...defaultConfig,
    ...svgAssetPluginOptions,
    lastModifiedTime,
  };

  return config;
}
