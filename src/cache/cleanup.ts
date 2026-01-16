import path from "node:path";
import fse from "fs-extra";
import * as fsUtils from "../utils/fs";
import { parseFilename } from "./filename";

/**
 * Track which asset versions (path + name + hash) have been processed.
 * This allows us to detect when a source file has changed (new hash for known asset).
 */
const processedAssets = new Map<
	string /* directory path */,
	Map<string /* asset name */, Set<string /* asset version hash */>> | "cleaned"
>();

/**
 * Age threshold for removing cached files (1 day in milliseconds)
 * Files older than this may be removed during cleanup.
 */
const CACHE_AGE_THRESHOLD = 24 * 60 * 60 * 1000;

/**
 * Processes asset version, and schedules cleanup of old cached versions
 * when a source file has changed.
 *
 * Detects changes by tracking which asset versions have been processed,
 * and triggers cleanup when a new hash appears for a known asset name.
 *
 * Files passed to the function are guaranteed to never be removed.
 */
export function processAssetCleanup(imageFilePath: string): void {
	const { dir: directoryPath, base: fileName } = path.parse(imageFilePath);

	let directoryAssets = processedAssets.get(directoryPath);
	if (directoryAssets === "cleaned") {
		// Already cleaned this directory, skip further processing
		return;
	}

	if (!directoryAssets) {
		directoryAssets = new Map();
		processedAssets.set(directoryPath, directoryAssets);
	}

	const parsed = parseFilename(fileName);

	if (!parsed) {
		return;
	}

	const { assetName, hash } = parsed;

	// Check if we've already processed this file
	let processedHashes = directoryAssets.get(assetName);
	if (!processedHashes) {
		processedHashes = new Set();
		directoryAssets.set(assetName, processedHashes);
	}

	processedHashes.add(hash);
	// More than one version for this asset, which means that the file has changed, trigger cleanup
	if (processedHashes.size > 1) {
		// Mark this directory as cleaned to avoid redundant cleanups
		processedAssets.set(directoryPath, "cleaned");
		cleanupOldVersions(directoryPath, directoryAssets).catch((error) => {
			console.warn(
				`Failed to cleanup old cached versions in: ${directoryPath}`,
				error,
			);
		});
	}
}

/**
 * Removes old cached files in the given directory that are haven't been processed during this process.
 */
async function cleanupOldVersions(
	directoryPath: string,
	directoryAssets: Map<string, Set<string>>,
): Promise<void> {
	const fileNames = await fse.readdir(directoryPath);

	// Deliberately using sequential processing to avoid hogging resources
	for (const fileName of fileNames) {
		const filePath = path.join(directoryPath, fileName);

		// Check file age
		const lastModifiedTime = await fsUtils.getLastModifiedTime(filePath);
		const age = Date.now() - lastModifiedTime;

		if (age < CACHE_AGE_THRESHOLD) {
			continue;
		}

		// Check if file has been processed
		const parsed = parseFilename(fileName);

		if (!parsed) {
			continue;
		}

		const { assetName, hash } = parsed;
		const processedHashes = directoryAssets.get(assetName);
		if (processedHashes?.has(hash)) {
			// This hash is still in use, skip removal
			continue;
		}

		// Remove old unused cached file
		// Use synchronous removal to make sure that file is gone before proceeding
		fse.removeSync(filePath);
	}
}
