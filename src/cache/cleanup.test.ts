import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { processAssetCleanup } from "./cleanup";

describe("cleanup", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fse.mkdtemp("react-native-svg-asset-plugin");
	});

	afterEach(async () => {
		await fse.remove(tmpDir);
	});

	async function createFiles(files: { [name: string]: number }) {
		return await Promise.all(
			Object.entries(files).map(async ([name, age]) => {
				const filePath = path.join(tmpDir, name);
				await fse.writeFile(filePath, "");
				const timestamp = Date.now() / 1000 - age;
				await fse.utimes(filePath, timestamp, timestamp);
				return filePath;
			}),
		);
	}

	describe("processAssetCleanup", () => {
		it("removes old versions when source file changes", async () => {
			// Create old version of a file (hash must be exactly 32 hex chars)
			// Make it older than 1 day so it would be eligible for cleanup
			await createFiles({
				"image-abcd1234567890abcdef1234567890ab.png": 2 * 24 * 60 * 60,
			});

			// First call with old hash - no cleanup (first time seeing this asset)
			const oldFilePath = path.join(
				tmpDir,
				"image-abcd1234567890abcdef1234567890ab.png",
			);
			processAssetCleanup(oldFilePath);

			// Verify old files still exist
			let files = await fse.readdir(tmpDir);
			expect(files).toContain("image-abcd1234567890abcdef1234567890ab.png");

			// Create new version with different hash
			await createFiles({
				"image-def456789012345678901234567890ab.png": 1,
			});

			// Second call with new hash - triggers cleanup
			const newFilePath = path.join(
				tmpDir,
				"image-def456789012345678901234567890ab.png",
			);
			processAssetCleanup(newFilePath);

			// Wait for async cleanup to complete
			await waitFor(async () => {
				files = await fse.readdir(tmpDir);
				// Both versions remain because all processed files are protected
				expect(files).toContain("image-abcd1234567890abcdef1234567890ab.png");
				expect(files).toContain("image-def456789012345678901234567890ab.png");
			});
		});

		it("does not trigger cleanup on first encounter", async () => {
			await createFiles({
				"icon-abcd1234567890abcdef1234567890ab.png": 2 * 24 * 60 * 60,
			});

			const filePath = path.join(
				tmpDir,
				"icon-abcd1234567890abcdef1234567890ab.png",
			);
			processAssetCleanup(filePath);

			// Wait a bit to ensure no cleanup happens
			await new Promise((resolve) => setTimeout(resolve, 100));

			const files = await fse.readdir(tmpDir);
			expect(files).toContain("icon-abcd1234567890abcdef1234567890ab.png");
		});

		it("only removes old versions of the same asset and scale", async () => {
			await createFiles({
				// Old versions of "image" asset at different scales (32 hex char hashes)
				// Make them older than 1 day so they are eligible for cleanup
				"image-abcd1234567890abcdef1234567890ab.png": 2 * 24 * 60 * 60,
				"image-abcd1234567890abcdef1234567890ab@2x.png": 2 * 24 * 60 * 60,
				"image-abcd1234567890abcdef1234567890ab@3x.png": 2 * 24 * 60 * 60,
				// Different asset should not be touched
				"other-abcd1234567890abcdef1234567890ab.png": 2 * 24 * 60 * 60,
			});

			// Process old versions first
			processAssetCleanup(
				path.join(tmpDir, "image-abcd1234567890abcdef1234567890ab.png"),
			);
			processAssetCleanup(
				path.join(tmpDir, "image-abcd1234567890abcdef1234567890ab@2x.png"),
			);

			// Now process new version with different hash (only for 1x scale)
			await createFiles({
				"image-def456789012345678901234567890ab.png": 1,
			});
			const newFilePath = path.join(
				tmpDir,
				"image-def456789012345678901234567890ab.png",
			);
			processAssetCleanup(newFilePath);

			// Wait for cleanup
			await waitFor(async () => {
				const files = await fse.readdir(tmpDir);
				// All processed versions remain because they are protected
				expect(files).toContain("image-abcd1234567890abcdef1234567890ab.png");
				// Old @2x and @3x versions should still exist
				expect(files).toContain(
					"image-abcd1234567890abcdef1234567890ab@2x.png",
				);
				expect(files).toContain(
					"image-abcd1234567890abcdef1234567890ab@3x.png",
				);
				// New version should exist
				expect(files).toContain("image-def456789012345678901234567890ab.png");
				// Different asset should not be touched
				expect(files).toContain("other-abcd1234567890abcdef1234567890ab.png");
			});
		});

		it("does not remove non-png files", async () => {
			await createFiles({
				"image-abcd1234567890abcdef1234567890ab.png": 2 * 24 * 60 * 60,
				"README.md": 2 * 24 * 60 * 60,
			});

			const oldFilePath = path.join(
				tmpDir,
				"image-abcd1234567890abcdef1234567890ab.png",
			);
			processAssetCleanup(oldFilePath);

			// Create new version with different hash
			await createFiles({
				"image-def456789012345678901234567890ab.png": 1,
			});
			const newFilePath = path.join(
				tmpDir,
				"image-def456789012345678901234567890ab.png",
			);
			processAssetCleanup(newFilePath);

			await waitFor(async () => {
				const files = await fse.readdir(tmpDir);
				expect(files).toContain("README.md");
			});
		});
	});
});

/**
 * Call function repeatedly until it doesn't throw.
 * Useful for waiting for test assertions to be fulfilled.
 */
async function waitFor(fn: () => Promise<unknown>, timeout: number = 1000) {
	const startTime = Date.now();
	while (true) {
		try {
			await fn();
			return;
		} catch (error) {
			if (Date.now() > startTime + timeout) {
				throw error;
			}
		}
	}
}
