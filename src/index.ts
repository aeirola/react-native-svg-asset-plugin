import path from "node:path";
import fse from "fs-extra";
import type { AssetData } from "metro";
import type { Metadata, PngOptions } from "sharp";
import * as cache from "./cache";
import type { Config } from "./config";
import * as config from "./config";
import * as sharp from "./sharp";
import * as fsUtils from "./utils/fs";
import * as funcUtils from "./utils/func";

/** Should match https://github.com/facebook/metro/blob/0.83.3/packages/metro/src/Assets.js#L89 */
type AssetDataPlugin = (assetData: AssetData) => AssetData | Promise<AssetData>;

const asyncConfig: Promise<Config> = config.load();

/**
 * Main function called by the metro bundler when processing an asset. This
 * plugin renders SVG assets into PNG files that can be used natively by
 * React Native apps.
 *
 * Note that metro caches the results of this function, so that multiple uses
 * of the same asset will not cause multiple calls to this function. This also
 * means that return values for old versions of a source file might be cached,
 * leading to metro expecting previously rendered PNG files to exist for
 * example when undoing changes to a source SVG file.
 *
 * @param assetData Data on the required asset provided by the metro bundler.
 * 				See below for examples.
 * @returns Modified asset data that points to the rendered PNG files.
 */
async function reactNativeSvgAssetPlugin(
	/**
	 * @example // Metro and React Native
	 * {
	 * 	 __packager_asset: true,
	 * 	 fileSystemLocation: '/src/app/images',
	 * 	 httpServerLocation: '/assets/images',
	 * 	 width: 100,
	 * 	 height: 100,
	 * 	 scales: [ 1 ],
	 * 	 files: [ '/src/app/images/icon.svg' ],
	 * 	 hash: '2f361af1b5dee4c16c567c61d8623df0',
	 * 	 name: 'icon',
	 * 	 type: 'svg'
	 * }
	 *
	 * @example // Expo dev build
	 * {
	 *   __packager_asset: true,
	 *   fileSystemLocation: '/src/app/images',
	 *   httpServerLocation: '/assets/?unstable_path=./images',
	 *   width: 200,
	 *   height: 200,
	 *   scales: [ 1 ],
	 *   files: [ '/src/app/images/icon.svg' ],
	 *   hash: '2f361af1b5dee4c16c567c61d8623df0',
	 *   name: 'icon',
	 *   type: 'svg'
	 * }
	 *
	 * @example // Expo production build
	 * {
	 *   __packager_asset: true,
	 *   fileSystemLocation: '/src/app/images',
	 *   httpServerLocation: '/assets?export_path=/assets/images',
	 *   width: 200,
	 *   height: 200,
	 *   scales: [ 1 ],
	 *   files: [ '/src/app/images/icon.svg' ],
	 *   hash: '2f361af1b5dee4c16c567c61d8623df0',
	 *   name: 'icon',
	 *   type: 'svg'
	 * }
	 */
	assetData: AssetData,
): Promise<AssetData> {
	const filePath = assetData.files[0] || "";
	if (await shouldConvertFile(assetData, filePath)) {
		return convertSvg(assetData);
	} else {
		return assetData;
	}
}

export = reactNativeSvgAssetPlugin satisfies AssetDataPlugin;

async function shouldConvertFile(
	assetData: AssetData,
	filePath: string,
): Promise<boolean> {
	if (assetData.type !== "svg") {
		return false;
	}

	const ignoreRegex = (await asyncConfig).ignoreRegex;
	if (ignoreRegex?.test(filePath)) {
		return false;
	}

	return true;
}

async function convertSvg(assetData: AssetData): Promise<AssetData> {
	if (assetData.scales.length !== assetData.files.length) {
		throw new Error("Passed scales doesn't match passed files.");
	} else if (assetData.files[0] === undefined) {
		throw new Error("No files passed.");
	} else if (assetData.files.length > 1) {
		throw new Error("Multiple SVG scales not supported.");
	} else if (assetData.scales[0] !== 1) {
		throw new Error("Scaled SVGs not supported.");
	}

	const inputFilePath = assetData.files[0];
	const inputFileScale = assetData.scales[0];

	const config = await asyncConfig;

	// Get the output directory where generated assets should be placed
	const outputDirectory = await cache.getCacheStoragePath(config, assetData);

	const outputName = `${assetData.name}-${assetData.hash}`;
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
		type: "png",
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
		throw new Error("Input image missing density information");
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
			return "";
		default:
			return `@${scale}x`;
	}
}
