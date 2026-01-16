import type { Config } from "../config";
import * as fsUtils from "../utils/fs";
import { processAssetCleanup } from "./cleanup";

/**
 * Determines wether the given output file is outdated,
 * meaning that it should be (re)written.
 *
 * @param outputFilePath - Path to the PNG file that is needed
 * @param config - Plugin configuration containing lastModifiedTime of the config
 * @returns `true` if the file needs to be regenerated (file doesn't exist or is older than config),
 *          `false` if the cached file is still valid and can be reused, but last modified time must be updated.
 */
export async function isFileOutdated(
	outputFilePath: string,
	config: Config,
): Promise<boolean> {
	// Process this asset version, and clean up old versions if the source has changed.
	processAssetCleanup(outputFilePath);

	const outputLastWrittenTimeStamp =
		await fsUtils.getLastModifiedTime(outputFilePath);

	if (outputLastWrittenTimeStamp === 0) {
		// File doesn't exist, or timestamps messed up
		// Better to generate a new file
		return true;
	} else {
		// File has been generated before, but has been removed from metro cache.
		// Regenerate the file if it is older than the plugin configuration
		return outputLastWrittenTimeStamp < config.lastModifiedTime;
	}
}
