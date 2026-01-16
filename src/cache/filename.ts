/**
 * Utilities for working with cached PNG filename structure.
 *
 * Filename format: `{assetName}-{hash}[@{scale}x].png`
 * Examples:
 *   - icon-abcd1234567890abcdef1234567890ab.png (1x scale)
 *   - icon-abcd1234567890abcdef1234567890ab@2x.png (2x scale)
 */

/**
 * Regular expression pattern for parsing cached PNG filenames.
 * Captures: assetName, hash, and optional scale suffix.
 */
const FILENAME_PATTERN = /^(.+)-([0-9a-f]{32})(@\d+x)?\.png$/;

/**
 * Parsed components of a cached PNG filename.
 */
export interface ParsedFilename {
	/** Asset name (e.g., "icon") */
	assetName: string;
	/** MD5 hash of the source file (32 hex characters) */
	hash: string;
	/** Scale suffix including the @ symbol (e.g., "@2x", "@3x"), or empty string for 1x */
	scaleSuffix: string;
}

/**
 * Parses a cached PNG filename into its components.
 *
 * @param fileName - The filename to parse (e.g., "icon-abcd1234567890abcdef1234567890ab@2x.png")
 * @returns Parsed components if the filename matches the expected pattern, otherwise undefined
 */
export function parseFilename(fileName: string): ParsedFilename | undefined {
	const match = fileName.match(FILENAME_PATTERN);
	if (!match) {
		return undefined;
	}

	const assetName = match[1];
	const hash = match[2];
	const scaleSuffix = match[3] || "";

	if (!assetName || !hash) {
		return undefined;
	}

	return {
		assetName,
		hash,
		scaleSuffix,
	};
}

/**
 * Builds a cached PNG filename from its components.
 *
 * @param assetName - The asset name
 * @param hash - The MD5 hash
 * @param scale - The scale value (e.g., 1, 2, 3)
 * @returns Complete filename (e.g., "icon-abcd1234567890abcdef1234567890ab@2x.png")
 */
export function buildFilename(
	assetName: string,
	hash: string,
	scale: number,
): string {
	const scaleSuffix = scale === 1 ? "" : `@${scale}x`;
	return `${assetName}-${hash}${scaleSuffix}.png`;
}
