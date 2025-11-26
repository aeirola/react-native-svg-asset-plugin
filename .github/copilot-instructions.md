# Copilot Instructions for react-native-svg-asset-plugin

## Project Overview

This is a **Metro bundler asset plugin** that converts SVG files to PNG images at compile time for React Native apps. It intercepts SVG assets during Metro's transformation phase and generates scaled PNGs (1x, 2x, 3x) using Sharp/libvips.

## MCP servers

### Context7

Use context7 MCP server for documentation lookup. Especially use /lovell/sharp for image conversion, and /facebook/metro for information on the metro bundler.

## Core Architecture

### Entry Point (`src/index.ts`)
Exports a single default function matching Metro's `AssetDataPlugin` type:
```typescript
(assetData: AssetData) => AssetData | Promise<AssetData>
```

### Data Flow
1. Metro calls plugin for each asset
2. Check if SVG and not ignored → `shouldConvertFile()`
3. Generate PNGs at configured scales → `convertSvg()`
4. Return modified `AssetData` pointing to generated PNG files
