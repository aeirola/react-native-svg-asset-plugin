import type sharpType from 'sharp';
import * as funcUtils from './utils/func';

/**
 * Load sharp conditionally.
 *
 * Since the sharp library is quite large, this is useful
 * when you might not want to load the whole library
 * at startup.
 */
export const load: () => Promise<typeof sharpType> = funcUtils.memo(
  async () => {
    const sharp = require('sharp');

    await warmup(sharp);
    return sharp;
  },
);

/**
 * Warms up the sharp library, handling any warmup errors.
 */
async function warmup(sharp: typeof sharpType): Promise<void> {
  // First run might cause a xmllib error, run safe warmup
  // See https://github.com/lovell/sharp/issues/1593
  try {
    await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" /></svg>`,
        'utf-8',
      ),
    ).metadata();
  } catch {}
}
