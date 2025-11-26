import type sharpType from "sharp";

/**
 * Load sharp conditionally.
 *
 * Since the sharp library is quite large, this is useful
 * when you might not want to load the whole library
 * at startup.
 */
export async function load(): Promise<typeof sharpType> {
	const sharp = (await import("sharp")).default;
	return sharp;
}
