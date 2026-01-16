import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as cache from "./index";

describe("cache", () => {
	let tmpDir: string;
	beforeEach(async () => {
		tmpDir = await fse.mkdtemp(
			path.join(os.tmpdir(), "react-native-svg-asset-plugin-"),
		);
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
});
