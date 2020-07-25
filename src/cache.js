/**
 * @flow strict-local
 */

const path = require('path');
const fse = require('fs-extra');

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

  if (outputLastWrittenTimeStamp === 0) {
    // File doesn't exist, or timestamps messed up
    // Better to generate a new file
    return true;
  } else {
    // File has been generated before, but has been removed from metro cache.

    // We can safely remove all generated files in the directory which are
    // older than the current file.
    scheduleCleanup(outputFilePath, outputLastWrittenTimeStamp);

    // Regenerate the file if it is older than the plugin configuration
    return outputLastWrittenTimeStamp < config.lastModifiedTime;
  }
}

// Only clean up each directory once per plugin instance.
// Keep track of already cleaned directories here.
const scheduledDirectoryCleanups = new Set();
// Time to wait until cache cleanup is executed.
// This gives the metro server time and resources to
// process all assets before performing cleanup.
const cleanupDelay = 5 * 60 * 1000;
// Age that files must be older than last seen evicted file
// for it to be removed.
const fileAgeBuffer = 24 * 60 * 60 * 1000;

/**
 * Cleans up cache directory
 */
function scheduleCleanup(imageFilePath: string, timestamp: number): void {
  const directoryPath = path.dirname(imageFilePath);
  if (scheduledDirectoryCleanups.has(directoryPath)) {
    // Directory has already been scheduled for processing by another call.
    // Do nothing.
    return;
  }

  scheduledDirectoryCleanups.add(directoryPath);
  setTimeout(async () => {
    try {
      await removeFilesOlderThan(directoryPath, timestamp - fileAgeBuffer);
    } catch {}
  }, cleanupDelay);
}

/**
 * Cleans up directory, removing all PNG images which are older than the given
 * timestamp.
 */
async function removeFilesOlderThan(
  directoryPath: string,
  timestamp: number,
): Promise<void> {
  let fileNames;
  try {
    fileNames = await fse.readdir(directoryPath);
  } catch {
    return;
  }

  // Delibreately using slower sequential processing
  // so that we don't hog resources from high prio work
  for (const fileName of fileNames) {
    const fileExtension = path.extname(fileName);
    if (fileExtension !== '.png') {
      continue;
    }

    const filePath = path.join(directoryPath, fileName);
    const lastModifiedTime = await fsUtils.getLastModifiedTime(filePath);
    if (lastModifiedTime < timestamp) {
      await fse.remove(filePath);
    }
  }
}
