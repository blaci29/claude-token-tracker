#!/bin/bash
# Build script for Claude Token Tracker extension
#
# This script compiles TypeScript sources and copies static assets into the
# `dist` directory. It can be run from the `extension/` directory on Unix-like
# systems (e.g. WSL). Make sure `node` and `npx` are installed.

set -e

DIR=$(cd "$(dirname "$0")" && pwd)

cd "$DIR"

echo "[Claude Token Tracker] Cleaning dist directory..."
rm -rf dist
mkdir -p dist/overlay dist/workers

echo "[Claude Token Tracker] Compiling TypeScript..."
npx tsc --project tsconfig.json

echo "[Claude Token Tracker] Copying static HTML/CSS files..."
cp src/popup/popup.html dist/popup.html
cp src/popup/popup.css dist/popup.css
cp src/options/options.html dist/options.html
cp src/options/options.css dist/options.css

echo "[Claude Token Tracker] Build complete."