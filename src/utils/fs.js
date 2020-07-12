/**
 * @flow strict-local
 */

const fse = require('fs-extra');

export async function getLastModifiedTime(filePath: string): Promise<number> {
  try {
    const fileStats = await fse.stat(filePath);
    return fileStats.mtimeMs;
  } catch {
    return 0;
  }
}

export async function updateLastModifiedTime(filePath: string): Promise<void> {
  const currentTime = Date.now() / 1000;
  try {
    await fse.utimes(filePath, currentTime, currentTime);
  } catch {}
}
