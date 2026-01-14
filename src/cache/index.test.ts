import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as cache from "./index";

describe("cache", () => {
	let tmpDir: string;
	beforeEach(async () => {
		tmpDir = await fse.mkdtemp("react-native-svg-asset-plugin");
	});

	afterEach(async () => {
		await fse.remove(tmpDir);
	});

	const config = {
		cacheDir: ".png-cache",
		scales: [1, 2, 3],
		output: {},
		ignoreRegex: null,
		lastModifiedTime: Date.now(),
	};

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

	describe("isFileOutdated", () => {
		it("returns true for old files", async () => {
			const [filePath] = await createFiles({
				"file.png": 10,
			});

			expect(await cache.isFileOutdated(filePath || "", config)).toBe(true);
		});

		it("returns false for new files", async () => {
			const [filePath] = await createFiles({
				"file.png": -10,
			});

			expect(await cache.isFileOutdated(filePath || "", config)).toBe(false);
		});

		it("returns true for missing files", async () => {
			const nonexistentFilePath = path.join(tmpDir, "nonexistent.png");
			expect(await cache.isFileOutdated(nonexistentFilePath, config)).toBe(
				true,
			);
		});
	});

	describe("scheduleCleanup", () => {
		it("removes old images", async () => {
			const [filePath] = await createFiles({
				"new-image.png": 1 * 60 * 60,
				"old-image.png": 2 * 24 * 60 * 60,
			});

			await callAndRunTimers(() =>
				cache.isFileOutdated(filePath || "", config),
			);

			await waitFor(async () =>
				expect(await fse.readdir(tmpDir)).toEqual(["new-image.png"]),
			);
		});

		it("does not remove old non-png", async () => {
			const [filePath] = await createFiles({
				"README.md": 30 * 24 * 60 * 60,
			});

			await callAndRunTimers(() =>
				cache.isFileOutdated(filePath || "", config),
			);

			await waitFor(async () =>
				expect(await fse.readdir(tmpDir)).toEqual(["README.md"]),
			);
		});
	});
});

/**
 * Call function running all timers immediately.
 * Useful for triggering background cleanups.
 */
async function callAndRunTimers(fn: () => Promise<unknown>) {
	vi.useFakeTimers();
	await fn();
	vi.runAllTimers();
	vi.useRealTimers();
}

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
