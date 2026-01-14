import type { Config } from "../config";
import * as fsUtils from "../utils/fs";
import { scheduleCleanup } from "./cleanup";

/**
 * Determines wether the given output file is outdated,
 * meaning that it should be (re)written.
 */
export async function isFileOutdated(
	outputFilePath: string,
	config: Config,
): Promise<boolean> {
	const outputLastWrittenTimeStamp =
		await fsUtils.getLastModifiedTime(outputFilePath);

	if (outputLastWrittenTimeStamp === 0) {
		// File doesn't exist, or timestamps messed up
		// Better to generate a new file
		return true;
	} else {
		// File has been generated before, but has been removed from metro cache.

		// We can safely remove all generated files in the directory which are
		// older than the current file.
		scheduleCleanup(outputFilePath, outputLastWrittenTimeStamp);

		// Regenerate the file if it is older than the plugin configuration
		return outputLastWrittenTimeStamp < config.lastModifiedTime;
	}
}
