import path from "node:path";
import fse from "fs-extra";
import * as fsUtils from "../utils/fs";

// Only clean up each directory once per plugin instance.
// Keep track of already cleaned directories here.
const scheduledDirectoryCleanups = new Set<string>();

// Time to wait until cache cleanup is executed.
// This gives the metro server time and resources to
// process all assets before performing cleanup.
const cleanupDelay = 5 * 60 * 1000;

// Age that files must be older than last seen evicted file
// for it to be removed.
const fileAgeBuffer = 24 * 60 * 60 * 1000;

/**
 * Cleans up cache directory
 */
export function scheduleCleanup(
	imageFilePath: string,
	timestamp: number,
): void {
	const directoryPath = path.dirname(imageFilePath);
	if (scheduledDirectoryCleanups.has(directoryPath)) {
		// Directory has already been scheduled for processing by another call.
		// Do nothing.
		return;
	}

	scheduledDirectoryCleanups.add(directoryPath);
	setTimeout(async () => {
		try {
			await removeFilesOlderThan(directoryPath, timestamp - fileAgeBuffer);
		} catch {}
	}, cleanupDelay);
}

/**
 * Cleans up directory, removing all PNG images which are older than the given
 * timestamp.
 */
async function removeFilesOlderThan(
	directoryPath: string,
	timestamp: number,
): Promise<void> {
	let fileNames: string[];
	try {
		fileNames = await fse.readdir(directoryPath);
	} catch {
		return;
	}

	// Delibreately using slower sequential processing
	// so that we don't hog resources from high prio work
	for (const fileName of fileNames) {
		const fileExtension = path.extname(fileName);
		if (fileExtension !== ".png") {
			continue;
		}

		const filePath = path.join(directoryPath, fileName);
		const lastModifiedTime = await fsUtils.getLastModifiedTime(filePath);
		if (lastModifiedTime < timestamp) {
			await fse.remove(filePath);
		}
	}
}
