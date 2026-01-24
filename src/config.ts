import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { MetroConfig } from "metro";
import type { PngOptions } from "sharp";
import * as fsUtils from "./utils/fs";

export interface Config {
	cacheDir: string;
	cacheStorageDir: string;
	projectRoot: string;
	scales: number[];
	output: PngOptions;
	ignoreRegex: RegExp | null;
	lastModifiedTime: number;
}

const defaultConfig: Config = {
	cacheDir: ".png-cache",
	cacheStorageDir: path.join(
		os.tmpdir(),
		"react-native-svg-asset-plugin-cache",
		// Use an 8 character hash of the project directory to avoid collisions
		crypto
			.createHash("md5")
			.update(process.cwd())
			.digest("hex")
			.substring(0, 8),
	),
	projectRoot: process.cwd(),
	scales: [1, 2, 3],
	output: {},
	ignoreRegex: null,
	lastModifiedTime: 0,
};

export async function load(): Promise<Config> {
	const metroConfigPath = path.join(process.cwd(), "metro.config.js");

	const lastModifiedTime = Math.max(
		...(await Promise.all([
			fsUtils.getLastModifiedTime(metroConfigPath),
			fsUtils.getLastModifiedTime(__filename),
		])),
	);

	let metroConfig: MetroConfig & {
		transformer?: MetroConfig["transformer"] & { svgAssetPlugin?: Config };
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
