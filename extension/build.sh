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
mkdir -p dist/popup dist/options dist/overlay dist/workers

echo "[Claude Token Tracker] Compiling TypeScript..."
npx tsc --project tsconfig.json

echo "[Claude Token Tracker] Copying static HTML/CSS files..."
cp src/popup/popup.html src/popup/popup.css dist/popup/
cp src/options/options.html src/options/options.css dist/options/

echo "[Claude Token Tracker] Build complete."