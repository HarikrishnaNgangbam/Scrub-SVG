# SVG Cleaner Web App

A simple, client-side web application that cleans up SVG files according to specific optimization criteria. No server required - everything runs in your browser!

## Features

- **Keep viewBox** - Preserves scalability for responsive design  
- **Remove width/height attributes** - Lets CSS control sizing  
- **Strip useless metadata** - Removes title, desc, and editor-specific cruft  
- **Flatten groups** - Simplifies structure by removing unnecessary grouping  
- **Remove hidden elements** - Eliminates invisible content  
- **Collapse transforms** - Optimizes redundant transformations  
- **Keep strokes/fills intact** - No unexpected visual changes  
- **Visual previews** - See before/after SVG rendering and code comparison
- **File size analysis** - Track optimization savings in real-time  

## How to Use

1. Open `index.html` in any modern web browser
2. Upload SVG files by:
   - Clicking "Choose SVG Files" button
   - Dragging and dropping files onto the upload area
3. View the before/after comparison and file size savings
4. Download the cleaned SVG files

## Technical Details

- **Pure JavaScript** - No external libraries or frameworks required
- **Client-side only** - Files never leave your computer
- **DOM-based processing** - Uses browser's native XML parsing
- **Responsive design** - Works on desktop and mobile devices

## File Structure

```
svg-cleaner/
├── index.html          # Main HTML page
├── styles.css          # CSS styling
├── svg-cleaner.js      # Core JavaScript logic
└── README.md          # This file
```

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript features
- DOM Parser API
- File API
- Drag and Drop API

## Optimization Details

The cleaner performs the following operations:

1. **Metadata Removal**: Strips `<title>`, `<desc>`, `<metadata>` elements and editor-specific namespaces
2. **Attribute Cleanup**: Removes `width` and `height` from root SVG element
3. **ViewBox Preservation**: Ensures viewBox attribute is maintained for scalability
4. **Group Flattening**: Removes unnecessary `<g>` elements that don't add value
5. **Hidden Element Removal**: Eliminates elements with `display:none` or `visibility:hidden`
6. **Transform Optimization**: Removes redundant transforms like `translate(0,0)` and `scale(1)`
7. **Style Cleanup**: Removes empty style attributes

## Example

**Before cleaning:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <title>My Icon</title>
  <desc>Created with Illustrator</desc>
  <g transform="translate(0,0)">
    <circle cx="50" cy="50" r="40" fill="blue"/>
  </g>
</svg>
```

**After cleaning:**
```xml
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>
```

## License

This project is open source and available under the MIT License.