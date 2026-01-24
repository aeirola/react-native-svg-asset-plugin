import path from "node:path";
import fse from "fs-extra";
import type { AssetData } from "metro";
import type { Config } from "../config";

/**
 * Returns the directory path where generated assets should be stored. Ensures
 * that it exists.
 */
export async function getCacheStoragePath(
	config: Config,
	assetData: AssetData,
): Promise<string> {
	// Store generated images in separate directories for each source image directory
	const cacheDir = path.join(
		config.cacheStorageDir,
		assetData.httpServerLocation,
	);

	// Ensure the actual cache directory exists
	await fse.ensureDir(cacheDir);

	const projectSymlink = path.join(
		assetData.fileSystemLocation,
		config.cacheDir,
	);

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
		const files = await fse.readdir(projectSymlink);
		await Promise.all(
			files.map((file) =>
				fse.move(path.join(projectSymlink, file), path.join(cacheDir, file), {
					overwrite: true,
				}),
			),
		);
		// Remove old directory and create symlink
		await fse.remove(projectSymlink);
		await fse.symlink(cacheDir, projectSymlink, "dir");
	} else {
		// Remove file or other non-directory entry
		await fse.remove(projectSymlink);
		await fse.symlink(cacheDir, projectSymlink, "dir");
	}

	return projectSymlink;
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
