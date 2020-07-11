/**
 * @flow strict-local
 */

/**
 * Returns a memoized version of the async callback function which
 * will always return the same value on subsequent calls.
 *
 * This is useful to provide lazy, but cached, loading of data.
 */
export function memo<T>(callback: () => Promise<T>): () => Promise<T> {
  let memoizedValue: Promise<T>;

  return () => {
    if (!memoizedValue) {
      memoizedValue = callback();
    }

    return memoizedValue;
  };
}
