/**
 * @flow strict-local
 */

const fsUtils = require('./utils/fs');

import type { Config } from './config';

/**
 * Determines wether the given output file is outdated,
 * meaning that it should be (re)written.
 */
export async function isFileOutdated(
  outputFilePath: string,
  config: Config,
): Promise<boolean> {
  const outputLastWrittenTimeStamp = await fsUtils.getLastModifiedTime(
    outputFilePath,
  );

  return outputLastWrittenTimeStamp < config.lastModifiedTime;
}
