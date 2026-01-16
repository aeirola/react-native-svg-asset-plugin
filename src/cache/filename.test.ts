import { describe, expect, it } from "vitest";
import { buildFilename, parseFilename } from "./filename";

describe("parseFilename", () => {
	it("parses 1x filename", () =>
		expect(parseFilename("icon-abcd1234567890abcdef1234567890ab.png")).toEqual({
			assetName: "icon",
			hash: "abcd1234567890abcdef1234567890ab",
			scaleSuffix: "",
		}));

	it("parses 2x filename", () =>
		expect(
			parseFilename("icon-abcd1234567890abcdef1234567890ab@2x.png"),
		).toEqual({
			assetName: "icon",
			hash: "abcd1234567890abcdef1234567890ab",
			scaleSuffix: "@2x",
		}));

	it("parses 3x filename", () =>
		expect(
			parseFilename("icon-abcd1234567890abcdef1234567890ab@3x.png"),
		).toEqual({
			assetName: "icon",
			hash: "abcd1234567890abcdef1234567890ab",
			scaleSuffix: "@3x",
		}));

	it("returns undefined for filename without hash", () =>
		expect(parseFilename("icon.png")).toBeUndefined());

	it("returns undefined for filename with short hash", () =>
		expect(parseFilename("icon-abcd1234567890ab.png")).toBeUndefined());

	it("returns undefined for non-png filename", () =>
		expect(
			parseFilename("icon-abcd1234567890abcdef1234567890ab.svg"),
		).toBeUndefined());
});

describe("buildFilename", () => {
	it("builds 1x filename", () =>
		expect(buildFilename("icon", "abcd1234567890abcdef1234567890ab", 1)).toBe(
			"icon-abcd1234567890abcdef1234567890ab.png",
		));

	it("builds 2x filename", () =>
		expect(buildFilename("icon", "abcd1234567890abcdef1234567890ab", 2)).toBe(
			"icon-abcd1234567890abcdef1234567890ab@2x.png",
		));

	it("builds 3x filename", () =>
		expect(buildFilename("icon", "abcd1234567890abcdef1234567890ab", 3)).toBe(
			"icon-abcd1234567890abcdef1234567890ab@3x.png",
		));

	it("builds filename with hyphens in asset name", () =>
		expect(
			buildFilename("my-icon-name", "abcd1234567890abcdef1234567890ab", 2),
		).toBe("my-icon-name-abcd1234567890abcdef1234567890ab@2x.png"));
});
