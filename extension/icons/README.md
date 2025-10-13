# Icons

## Current Status
The `icon.svg` file is a placeholder icon for the extension.

## Required Sizes
Chrome extensions need PNG icons in these sizes:
- `icon-16.png` - 16x16 pixels (toolbar)
- `icon-48.png` - 48x48 pixels (extension management page)
- `icon-128.png` - 128x128 pixels (Chrome Web Store)

## Converting SVG to PNG

### Option 1: Online Tool
1. Open https://svgtopng.com/ or similar
2. Upload `icon.svg`
3. Export at 16px, 48px, and 128px
4. Save as `icon-16.png`, `icon-48.png`, `icon-128.png`

### Option 2: ImageMagick (Command Line)
```bash
# Install ImageMagick if needed
# brew install imagemagick  (macOS)
# apt-get install imagemagick  (Linux)

# Convert to different sizes
convert icon.svg -resize 16x16 icon-16.png
convert icon.svg -resize 48x48 icon-48.png
convert icon.svg -resize 128x128 icon-128.png
```

### Option 3: Figma/Sketch/Illustrator
1. Open `icon.svg` in your design tool
2. Export as PNG at 16px, 48px, and 128px
3. Save with appropriate filenames

## Custom Icon
Feel free to replace `icon.svg` with your own design! Just make sure to:
- Keep it recognizable at small sizes (16px)
- Use colors that work on both light and dark backgrounds
- Export all three required PNG sizes

## Current Icon Design
The placeholder icon shows:
- Gradient purple background
- Bar chart representing token counts
- "T" badge for "Tracker"

**This is just a placeholder - feel free to design something better!** 🎨