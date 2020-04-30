/**
 * Adapted from https://www.npmjs.com/package/@types/sharp
 *
 * @flow strict-local
 * @format
 */

declare module 'ignore' {
  declare module.exports: typeof ignore;
  declare function ignore(): Ignore;

  declare type Ignore = {
    add(patterns: string | string[] | Ignore): Ignore,
    ignores(pathname: string): boolean,
  };
}
