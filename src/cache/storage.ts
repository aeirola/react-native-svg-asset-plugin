import path from "node:path";
import fse from "fs-extra";
import type { AssetData } from "metro";
import type { Config } from "../config";

/**
 * Module-level Map to track ongoing symlink creation operations.
 * Key: projectSymlink path, Value: Promise that resolves to the symlink path
 */
const symlinkOperations = new Map<string, Promise<string>>();

/**
 * Returns the directory path where generated assets should be stored. Ensures
 * that it exists.
 */
export async function getCacheStoragePath(
	config: Config,
	assetData: AssetData,
): Promise<string> {
	const projectSymlink = path.join(
		assetData.fileSystemLocation,
		config.cacheDir,
	);

	// Check if we're already processing this symlink
	const existingOperation = symlinkOperations.get(projectSymlink);
	if (existingOperation) {
		return existingOperation;
	}

	// Create a new operation for this symlink
	const operation = (async () => {
		// Store generated images in separate directories for each source image directory
		const cacheDir = path.join(
			config.cacheStorageDir,
			// Sanitize httpServerLocation to prevent path traversal
			path.join("/", new URL(assetData.httpServerLocation, "file://").pathname),
		);

		// Ensure the actual cache directory exists
		await fse.ensureDir(cacheDir);

		// Ensure symlink points to the cache directory
		const stats = await lstatIfExists(projectSymlink);

		if (!stats) {
			// Symlink doesn't exist, create it
			await fse.symlink(cacheDir, projectSymlink, "dir");
		} else if (stats.isSymbolicLink()) {
			const currentTarget = await fse.readlink(projectSymlink);
			if (currentTarget !== cacheDir) {
				// Replace incorrect symlink with correct one
				await fse.remove(projectSymlink);
				await fse.symlink(cacheDir, projectSymlink, "dir");
			}
		} else if (stats.isDirectory()) {
			// Migrate old cache directory to new location
			for (const file of await fse.readdir(projectSymlink)) {
				try {
					await fse.move(
						path.join(projectSymlink, file),
						path.join(cacheDir, file),
						{
							overwrite: true,
						},
					);
				} catch {
					// Ignore errors as missing files can be regenerated
				}
			}
			// Remove old directory and create symlink
			await fse.remove(projectSymlink);
			await fse.symlink(cacheDir, projectSymlink, "dir");
		} else {
			// Remove file or other non-directory entry
			await fse.remove(projectSymlink);
			await fse.symlink(cacheDir, projectSymlink, "dir");
		}

		return projectSymlink;
	})();

	// Store the operation in the Map
	symlinkOperations.set(projectSymlink, operation);

	return operation;
}

/**
 * Returns lstat for a path, or null if the path doesn't exist.
 */
async function lstatIfExists(filePath: string): Promise<fse.Stats | null> {
	try {
		return await fse.lstat(filePath);
	} catch (error: unknown) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return null;
		}
		throw error;
	}
}
