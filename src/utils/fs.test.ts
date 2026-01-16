import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { it as baseIt, describe, expect } from "vitest";
import * as fsUtils from "./fs";

describe("fsUtils", () => {
	const it = baseIt.extend<{
		testfilePath: string;
		nonexistingFilePath: string;
	}>({
		testfilePath: async ({}, use) => {
			const tmpDir = await fse.mkdtemp(
				path.join(os.tmpdir(), "react-native-svg-asset-plugin-"),
			);
			const testfilePath = path.join(tmpDir, "testfile");
			await fse.writeFile(testfilePath, "Empty file for testing fs functions");

			await use(testfilePath);

			await fse.remove(tmpDir);
		},

		nonexistingFilePath: async ({}, use) => {
			const tmpDir = await fse.mkdtemp(
				path.join(os.tmpdir(), "react-native-svg-asset-plugin-"),
			);
			const filePath = path.join(tmpDir, "non-existent-file");

			await use(filePath);

			await fse.remove(tmpDir);
		},
	});
	describe("getLastModifiedTime", () => {
		it("returns millisecond time for existing files", async ({
			testfilePath,
		}) => {
			expect(await fsUtils.getLastModifiedTime(testfilePath)).toBeGreaterThan(
				1590000000000,
			);
		});

		it("returns 0 on nonexisting files", async ({ nonexistingFilePath }) => {
			expect(await fsUtils.getLastModifiedTime(nonexistingFilePath)).toBe(0);
		});
	});

	describe("updateLastModifiedTime", () => {
		it("updates modified time of existing files", async ({ testfilePath }) => {
			const currentTime = Date.now();
			await fsUtils.updateLastModifiedTime(testfilePath);

			const modifiedTime = await fsUtils.getLastModifiedTime(testfilePath);
			expect(modifiedTime).toBeGreaterThan(currentTime - 5000);
			expect(modifiedTime).toBeLessThan(currentTime + 5000);
		});

		it("does not fail on unexisting files", async ({ nonexistingFilePath }) => {
			await fsUtils.updateLastModifiedTime(nonexistingFilePath);
		});
	});
});
