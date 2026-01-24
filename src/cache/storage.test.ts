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
		scales: [1, 2, 3],
		output: {},
		ignoreRegex: null,
		lastModifiedTime: Date.now(),
		...overrides,
	});

	const createAssetData = (
		fileSystemLocation: string,
		overrides?: Partial<AssetData>,
	): AssetData =>
		({
			__packager_asset: true,
			fileSystemLocation,
			httpServerLocation: "/assets",
			width: null,
			height: null,
			scales: [1, 2, 3],
			files: [],
			hash: "testhash",
			name: "test",
			type: "png",
			...overrides,
		}) as AssetData;

	const getExpectedCacheDir = (assetData: AssetData): string =>
		path.join(cacheStorageDir, assetData.httpServerLocation);

	describe("getCacheStoragePath", () => {
		describe("no previous cache exists", () => {
			it("creates cache storage directory", async () => {
				const config = createConfig();
				const assetData = createAssetData(projectDir);

				await getCacheStoragePath(config, assetData);

				const expectedCacheDir = getExpectedCacheDir(assetData);
				const cacheExists = await fse.pathExists(expectedCacheDir);
				expect(cacheExists).toBe(true);
			});

			it("creates symlink in project directory pointing to cache storage", async () => {
				const config = createConfig();
				const assetData = createAssetData(projectDir);

				const result = await getCacheStoragePath(config, assetData);

				const symlinkPath = path.join(projectDir, ".png-cache");
				expect(result).toBe(symlinkPath);

				const symlinkExists = await fse.pathExists(symlinkPath);
				expect(symlinkExists).toBe(true);

				const stats = await fse.lstat(symlinkPath);
				expect(stats.isSymbolicLink()).toBe(true);

				const target = await fse.readlink(symlinkPath);
				const expectedCacheDir = getExpectedCacheDir(assetData);
				expect(target).toBe(expectedCacheDir);
			});

			it("returns the symlink path", async () => {
				const config = createConfig();
				const assetData = createAssetData(projectDir);

				const result = await getCacheStoragePath(config, assetData);

				const expectedPath = path.join(projectDir, ".png-cache");
				expect(result).toBe(expectedPath);
			});
		});

		describe("cache exists in new format (symlink)", () => {
			it("returns existing symlink when correctly configured", async () => {
				const config = createConfig();
				const assetData = createAssetData(projectDir);
				const symlinkPath = path.join(projectDir, ".png-cache");
				const expectedCacheDir = getExpectedCacheDir(assetData);

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
				const assetData = createAssetData(projectDir);
				const symlinkPath = path.join(projectDir, ".png-cache");
				const wrongTarget = path.join(tmpDir, "wrong-cache");
				const expectedCacheDir = getExpectedCacheDir(assetData);

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
				const assetData = createAssetData(projectDir);

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
				const assetData = createAssetData(projectDir);
				const oldCacheDir = path.join(projectDir, ".png-cache");
				const expectedCacheDir = getExpectedCacheDir(assetData);

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
				const assetData = createAssetData(projectDir);
				const oldCacheDir = path.join(projectDir, ".png-cache");
				const expectedCacheDir = getExpectedCacheDir(assetData);

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
				const assetData = createAssetData(projectDir);
				const oldCacheDir = path.join(projectDir, ".png-cache");
				const expectedCacheDir = getExpectedCacheDir(assetData);

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
				const assetData = createAssetData(projectDir);
				const filePath = path.join(projectDir, ".png-cache");
				const expectedCacheDir = getExpectedCacheDir(assetData);

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
				const assetData = createAssetData(projectDir);

				const result = await getCacheStoragePath(config, assetData);

				const expectedPath = path.join(projectDir, ".custom-cache");
				expect(result).toBe(expectedPath);

				// Verify symlink exists
				const stats = await fse.lstat(expectedPath);
				expect(stats.isSymbolicLink()).toBe(true);
			});
		});

		describe("different project locations", () => {
			it("creates separate symlinks for different project locations", async () => {
				const config = createConfig();
				const projectDir1 = path.join(tmpDir, "project1");
				const projectDir2 = path.join(tmpDir, "project2");
				await fse.ensureDir(projectDir1);
				await fse.ensureDir(projectDir2);

				const assetData1 = createAssetData(projectDir1);
				const assetData2 = createAssetData(projectDir2);

				const result1 = await getCacheStoragePath(config, assetData1);
				const result2 = await getCacheStoragePath(config, assetData2);

				expect(result1).toBe(path.join(projectDir1, ".png-cache"));
				expect(result2).toBe(path.join(projectDir2, ".png-cache"));

				// Both should point to the same cache storage (with httpServerLocation subdirectory)
				const expectedCacheDir = getExpectedCacheDir(assetData1);
				const target1 = await fse.readlink(result1);
				const target2 = await fse.readlink(result2);
				expect(target1).toBe(expectedCacheDir);
				expect(target2).toBe(expectedCacheDir);
			});

			it("stores files from different source directories in separate cache directories", async () => {
				const config = createConfig();
				const projectDir1 = path.join(tmpDir, "project1");
				const projectDir2 = path.join(tmpDir, "project2");
				await fse.ensureDir(projectDir1);
				await fse.ensureDir(projectDir2);

				// Create asset data with different httpServerLocation values
				const assetData1 = createAssetData(projectDir1, {
					httpServerLocation: "/assets/images",
				});
				const assetData2 = createAssetData(projectDir2, {
					httpServerLocation: "/assets/icons",
				});

				const result1 = await getCacheStoragePath(config, assetData1);
				const result2 = await getCacheStoragePath(config, assetData2);

				// Symlinks should point to different cache subdirectories
				const target1 = await fse.readlink(result1);
				const target2 = await fse.readlink(result2);

				const expectedCacheDir1 = getExpectedCacheDir(assetData1);
				const expectedCacheDir2 = getExpectedCacheDir(assetData2);

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
	});
});
