import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import type { AssetData } from "metro";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../config";
import { getCacheStoragePath } from "./storage";

describe("storage", () => {
	let tmpDir: string;
	let cacheStorageDir: string;
	let projectDir: string;

	beforeEach(async () => {
		tmpDir = await fse.mkdtemp(
			path.join(os.tmpdir(), "react-native-svg-asset-plugin-storage-test-"),
		);
		cacheStorageDir = path.join(tmpDir, "cache-storage");
		projectDir = path.join(tmpDir, "project");
		await fse.ensureDir(projectDir);
	});

	afterEach(async () => {
		await fse.remove(tmpDir);
	});

	const createConfig = (overrides?: Partial<Config>): Config => ({
		cacheDir: ".png-cache",
		cacheStorageDir,
		projectRoot: projectDir,
		scales: [1, 2, 3],
		output: {},
		ignoreRegex: null,
		lastModifiedTime: Date.now(),
		...overrides,
	});

	const createAssetData = async (
		overrides?: Partial<AssetData>,
	): Promise<AssetData> => {
		const assetData = {
			__packager_asset: true,
			fileSystemLocation: path.join(projectDir, "assets", "images"),
			/* This varies depending on configurations (metro, rn, expo, etc.) */
			httpServerLocation: `/assets/?${new URLSearchParams({
				unstable_path: "./assets/images/icon.svg",
				platform: "ios",
				hash: "257762e72ca966a7f85b46b3de9c0c3f",
			})}`,
			scales: [1],
			files: [path.join(projectDir, "assets", "images", "icon.svg")],
			hash: "257762e72ca966a7f85b46b3de9c0c3f",
			name: "icon",
			type: "svg",
			...overrides,
		};

		await fse.ensureDir(assetData.fileSystemLocation);

		return assetData;
	};

	describe("getCacheStoragePath", () => {
		describe("no previous cache exists", () => {
			it("creates cache storage directory", async () => {
				const config = createConfig();
				const assetData = await createAssetData();

				await getCacheStoragePath(config, assetData);

				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");
				const cacheExists = await fse.pathExists(expectedCacheDir);
				expect(cacheExists).toBe(true);
			});

			it("creates symlink in project directory pointing to cache storage", async () => {
				const config = createConfig();
				const assetData = await createAssetData();

				const symlinkPath = await getCacheStoragePath(config, assetData);

				const target = await fse.readlink(symlinkPath);
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");
				expect(target).toBe(expectedCacheDir);
			});

			it("returns the symlink path", async () => {
				const config = createConfig();
				const assetData = await createAssetData();

				const result = await getCacheStoragePath(config, assetData);

				const expectedPath = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				expect(result).toBe(expectedPath);
			});
		});

		describe("cache exists in new format (symlink)", () => {
			it("returns existing symlink when correctly configured", async () => {
				const config = createConfig();
				const assetData = await createAssetData();
				const symlinkPath = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");

				// Create symlink manually
				await fse.ensureDir(expectedCacheDir);
				await fse.symlink(expectedCacheDir, symlinkPath, "dir");

				const result = await getCacheStoragePath(config, assetData);

				expect(result).toBe(symlinkPath);

				// Verify symlink still points to correct location
				const target = await fse.readlink(symlinkPath);
				expect(target).toBe(expectedCacheDir);
			});

			it("recreates symlink when pointing to wrong location", async () => {
				const config = createConfig();
				const assetData = await createAssetData();
				const symlinkPath = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				const wrongTarget = path.join(tmpDir, "wrong-cache");
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");

				// Create symlink pointing to wrong location
				await fse.ensureDir(wrongTarget);
				await fse.symlink(wrongTarget, symlinkPath, "dir");

				const result = await getCacheStoragePath(config, assetData);

				expect(result).toBe(symlinkPath);

				// Verify symlink now points to correct location
				const target = await fse.readlink(symlinkPath);
				expect(target).toBe(expectedCacheDir);
			});

			it("preserves symlink across multiple calls", async () => {
				const config = createConfig();
				const assetData = await createAssetData();

				const result1 = await getCacheStoragePath(config, assetData);
				const result2 = await getCacheStoragePath(config, assetData);

				expect(result1).toBe(result2);

				// Verify symlink still valid
				const stats = await fse.lstat(result1);
				expect(stats.isSymbolicLink()).toBe(true);
			});
		});

		describe("cache exists in old format (directory)", () => {
			it("migrates old cache directory to new location", async () => {
				const config = createConfig();
				const assetData = await createAssetData();
				const oldCacheDir = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");

				// Create old cache directory with files
				await fse.ensureDir(oldCacheDir);
				await fse.writeFile(path.join(oldCacheDir, "file1.png"), "content1");
				await fse.writeFile(path.join(oldCacheDir, "file2.png"), "content2");

				const result = await getCacheStoragePath(config, assetData);

				// Old directory should be replaced with symlink
				const stats = await fse.lstat(result);
				expect(stats.isSymbolicLink()).toBe(true);

				// Files should be moved to new location
				const file1Exists = await fse.pathExists(
					path.join(expectedCacheDir, "file1.png"),
				);
				const file2Exists = await fse.pathExists(
					path.join(expectedCacheDir, "file2.png"),
				);
				expect(file1Exists).toBe(true);
				expect(file2Exists).toBe(true);

				// Verify file contents were preserved
				const file1Content = await fse.readFile(
					path.join(expectedCacheDir, "file1.png"),
					"utf-8",
				);
				const file2Content = await fse.readFile(
					path.join(expectedCacheDir, "file2.png"),
					"utf-8",
				);
				expect(file1Content).toBe("content1");
				expect(file2Content).toBe("content2");
			});

			it("handles empty old cache directory", async () => {
				const config = createConfig();
				const assetData = await createAssetData();
				const oldCacheDir = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");

				// Create empty old cache directory
				await fse.ensureDir(oldCacheDir);

				const result = await getCacheStoragePath(config, assetData);

				// Should be replaced with symlink
				const stats = await fse.lstat(result);
				expect(stats.isSymbolicLink()).toBe(true);

				const target = await fse.readlink(result);
				expect(target).toBe(expectedCacheDir);
			});

			it("overwrites existing files in new location during migration", async () => {
				const config = createConfig();
				const assetData = await createAssetData();
				const oldCacheDir = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");

				// Create new cache location with existing file
				await fse.ensureDir(expectedCacheDir);
				await fse.writeFile(
					path.join(expectedCacheDir, "file.png"),
					"old-content",
				);

				// Create old cache directory with file
				await fse.ensureDir(oldCacheDir);
				await fse.writeFile(path.join(oldCacheDir, "file.png"), "new-content");

				await getCacheStoragePath(config, assetData);

				// File should be overwritten with new content
				const fileContent = await fse.readFile(
					path.join(expectedCacheDir, "file.png"),
					"utf-8",
				);
				expect(fileContent).toBe("new-content");
			});
		});

		describe("file exists at cache location", () => {
			it("removes file and creates symlink", async () => {
				const config = createConfig();
				const assetData = await createAssetData();
				const filePath = path.join(assetData.fileSystemLocation, ".png-cache");
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");

				// Create a regular file at the cache location
				await fse.writeFile(filePath, "some file content");

				const result = await getCacheStoragePath(config, assetData);

				// File should be replaced with symlink
				const stats = await fse.lstat(result);
				expect(stats.isSymbolicLink()).toBe(true);

				const target = await fse.readlink(result);
				expect(target).toBe(expectedCacheDir);
			});
		});

		describe("custom cache directory name", () => {
			it("uses custom cacheDir name", async () => {
				const config = createConfig({ cacheDir: ".custom-cache" });
				const assetData = await createAssetData();

				const result = await getCacheStoragePath(config, assetData);

				const expectedPath = path.join(
					assetData.fileSystemLocation,
					".custom-cache",
				);
				expect(result).toBe(expectedPath);

				// Verify symlink exists
				const stats = await fse.lstat(expectedPath);
				expect(stats.isSymbolicLink()).toBe(true);
			});
		});

		describe("different project locations", () => {
			it("creates separate cache directories for same fileSystemLocation with different project roots", async () => {
				const projectDir1 = path.join(tmpDir, "project1");
				const projectDir2 = path.join(tmpDir, "project2");
				await fse.ensureDir(projectDir1);
				await fse.ensureDir(projectDir2);

				const cacheStorageDir1 = path.join(tmpDir, "cache-storage-1");
				const cacheStorageDir2 = path.join(tmpDir, "cache-storage-2");

				const config1 = createConfig({
					projectRoot: projectDir1,
					cacheStorageDir: cacheStorageDir1,
				});
				const config2 = createConfig({
					projectRoot: projectDir2,
					cacheStorageDir: cacheStorageDir2,
				});

				const assetData1 = await createAssetData({
					fileSystemLocation: path.join(projectDir1, "assets", "images"),
				});
				const assetData2 = await createAssetData({
					fileSystemLocation: path.join(projectDir2, "assets", "images"),
				});

				const result1 = await getCacheStoragePath(config1, assetData1);
				const result2 = await getCacheStoragePath(config2, assetData2);

				// Both symlinks should be in the same location (same fileSystemLocation)
				expect(result1).toBe(
					path.join(assetData1.fileSystemLocation, ".png-cache"),
				);
				expect(result2).toBe(
					path.join(assetData2.fileSystemLocation, ".png-cache"),
				);

				// The symlinks should point to different cache directories based on project root
				// Since sharedAssetsDir is outside both project roots, relative path is computed differently
				const target1 = await fse.readlink(result1);
				const target2 = await fse.readlink(result2);

				expect(target1).toBe(path.join(cacheStorageDir1, "assets", "images"));
				expect(target2).toBe(path.join(cacheStorageDir2, "assets", "images"));
			});

			it("stores files from different source directories in separate cache directories", async () => {
				const config = createConfig();

				const assetData1 = await createAssetData({
					fileSystemLocation: path.join(projectDir, "assets", "icons"),
				});
				const assetData2 = await createAssetData({
					fileSystemLocation: path.join(projectDir, "assets", "images"),
				});

				const result1 = await getCacheStoragePath(config, assetData1);
				const result2 = await getCacheStoragePath(config, assetData2);

				// Symlinks should point to different cache subdirectories
				const target1 = await fse.readlink(result1);
				const target2 = await fse.readlink(result2);

				const expectedCacheDir1 = path.join(cacheStorageDir, "assets", "icons");
				const expectedCacheDir2 = path.join(
					cacheStorageDir,
					"assets",
					"images",
				);

				expect(target1).toBe(expectedCacheDir1);
				expect(target2).toBe(expectedCacheDir2);
				expect(target1).not.toBe(target2);

				// Verify both cache directories exist
				const cache1Exists = await fse.pathExists(expectedCacheDir1);
				const cache2Exists = await fse.pathExists(expectedCacheDir2);
				expect(cache1Exists).toBe(true);
				expect(cache2Exists).toBe(true);
			});
		});

		describe("concurrent calls", () => {
			it("handles concurrent calls to the same directory", async () => {
				const config = createConfig();
				const assetData = await createAssetData();

				// Make multiple concurrent calls
				const results = await Promise.all([
					getCacheStoragePath(config, assetData),
					getCacheStoragePath(config, assetData),
					getCacheStoragePath(config, assetData),
					getCacheStoragePath(config, assetData),
					getCacheStoragePath(config, assetData),
				]);

				// All results should be the same
				const expectedPath = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				for (const result of results) {
					expect(result).toBe(expectedPath);
				}

				// Symlink should exist and be valid
				const stats = await fse.lstat(expectedPath);
				expect(stats.isSymbolicLink()).toBe(true);

				const target = await fse.readlink(expectedPath);
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");
				expect(target).toBe(expectedCacheDir);
			});

			it("handles concurrent calls during directory migration", async () => {
				const config = createConfig();
				const assetData = await createAssetData();
				const oldCacheDir = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				const expectedCacheDir = path.join(cacheStorageDir, "assets", "images");

				// Create old cache directory with files
				await fse.ensureDir(oldCacheDir);
				await fse.writeFile(path.join(oldCacheDir, "file1.png"), "content1");
				await fse.writeFile(path.join(oldCacheDir, "file2.png"), "content2");
				await fse.writeFile(path.join(oldCacheDir, "file3.png"), "content3");

				// Make multiple concurrent calls during migration
				const results = await Promise.all([
					getCacheStoragePath(config, assetData),
					getCacheStoragePath(config, assetData),
					getCacheStoragePath(config, assetData),
					getCacheStoragePath(config, assetData),
				]);

				// All results should be the same
				const expectedPath = path.join(
					assetData.fileSystemLocation,
					".png-cache",
				);
				for (const result of results) {
					expect(result).toBe(expectedPath);
				}

				// Should be a symlink now
				const stats = await fse.lstat(expectedPath);
				expect(stats.isSymbolicLink()).toBe(true);

				// All files should have been migrated
				const file1Exists = await fse.pathExists(
					path.join(expectedCacheDir, "file1.png"),
				);
				const file2Exists = await fse.pathExists(
					path.join(expectedCacheDir, "file2.png"),
				);
				const file3Exists = await fse.pathExists(
					path.join(expectedCacheDir, "file3.png"),
				);
				expect(file1Exists).toBe(true);
				expect(file2Exists).toBe(true);
				expect(file3Exists).toBe(true);
			});

			it("handles concurrent calls to different directories", async () => {
				const config = createConfig();
				const projectDir1 = path.join(tmpDir, "project1");
				const projectDir2 = path.join(tmpDir, "project2");
				await fse.ensureDir(projectDir1);
				await fse.ensureDir(projectDir2);

				const assetData1 = await createAssetData({
					fileSystemLocation: projectDir1,
					httpServerLocation: "/assets/dir1",
				});
				const assetData2 = await createAssetData({
					fileSystemLocation: projectDir2,
					httpServerLocation: "/assets/dir2",
				});

				// Make concurrent calls to different directories
				const results = await Promise.all([
					getCacheStoragePath(config, assetData1),
					getCacheStoragePath(config, assetData2),
					getCacheStoragePath(config, assetData1),
					getCacheStoragePath(config, assetData2),
					getCacheStoragePath(config, assetData1),
					getCacheStoragePath(config, assetData2),
				]);

				// Check all results for dir1
				const expectedPath1 = path.join(
					assetData1.fileSystemLocation,
					".png-cache",
				);
				expect(results[0]).toBe(expectedPath1);
				expect(results[2]).toBe(expectedPath1);
				expect(results[4]).toBe(expectedPath1);

				// Check all results for dir2
				const expectedPath2 = path.join(
					assetData2.fileSystemLocation,
					".png-cache",
				);
				expect(results[1]).toBe(expectedPath2);
				expect(results[3]).toBe(expectedPath2);
				expect(results[5]).toBe(expectedPath2);

				// Both symlinks should exist and be valid
				const stats1 = await fse.lstat(expectedPath1);
				expect(stats1.isSymbolicLink()).toBe(true);

				const stats2 = await fse.lstat(expectedPath2);
				expect(stats2.isSymbolicLink()).toBe(true);
			});
		});
	});
});
