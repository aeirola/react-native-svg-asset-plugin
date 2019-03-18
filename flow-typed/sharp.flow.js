/**
 * Adapted from https://www.npmjs.com/package/@types/sharp
 *
 * @flow strict-local
 * @format
 */

declare module 'sharp' {
  declare module.exports: typeof sharp;
  declare function sharp(input: string | Buffer, options?: SharpOptions): Sharp;

  declare type Sharp = {
    metadata(): Promise<Metadata>,
    stats(): Promise<Stats>,
    png(options?: PngOptions): Sharp,
    toFile(fileOut: string): Promise<OutputInfo>,
  };

  declare interface SharpOptions {
    failOnError?: boolean;
    density?: number;
    page?: number;
  }

  declare interface Stats {
    channels: ChannelStats[];
    isOpaque: boolean;
    entropy: number;
  }

  declare interface ChannelStats {
    min: number;
    max: number;
    sum: number;
    squaresSum: number;
    mean: number;
    stdev: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  declare interface Metadata {
    orientation?: number;
    format?: string;
    size?: number;
    width?: number;
    height?: number;
    space?: string;
    depth?: string;
    density?: number;
    chromaSubsampling: string;
    isProgressive?: boolean;
    hasProfile?: boolean;
    hasAlpha?: boolean;
    exif?: Buffer;
    icc?: Buffer;
    iptc?: Buffer;
    xmp?: Buffer;
  }

  declare interface PngOptions {
    progressive?: boolean;
    compressionLevel?: number;
    adaptiveFiltering?: boolean;
    force?: boolean;
    quality?: number;
    palette?: boolean;
    colours?: number;
    colors?: number;
    dither?: number;
  }

  declare interface OutputInfo {
    format: string;
    size: number;
    width: number;
    height: number;
    channels: number;
  }
}
