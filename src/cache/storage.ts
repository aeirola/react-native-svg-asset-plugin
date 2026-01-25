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
		/* Store generated images in separate directories for each source image
			 directory. This makes it easier to validate the output of source files,
			 as well as makes the output directories smaller. */

		// Calculate relative path from project root to the asset's directory
		let subdirectoryPath = path.relative(
			config.projectRoot,
			assetData.fileSystemLocation,
		);

		/* Note that the httpServerLocation may not match the actual filesystem
			 location, as the metro server has multiple ways to specify the asset
			 path. See https://github.com/facebook/metro/blob/v0.83.3/packages/metro/src/Server.js#L517 */

		/* All imported assets should reside within the project root as the metro
			 bundler doesn't allow importing files from outside. But things might
			 change, so it should be handled regardless.

			 On Windows, path.relative() returns an absolute path when paths are on
			 different drives, so we need to check for that as well. */
		if (
			subdirectoryPath.startsWith("..") ||
			path.isAbsolute(subdirectoryPath)
		) {
			/* Note that directory collisions are not a concern, as all output files
			   have unique names based on their content hash. */
			subdirectoryPath = "";
		}

		const cacheDir = path.join(config.cacheStorageDir, subdirectoryPath);

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
