class SVGCleaner {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const dragDropArea = document.getElementById('dragDropArea');

        // File input change event
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop events
        dragDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragDropArea.classList.add('drag-over');
        });

        dragDropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragDropArea.classList.remove('drag-over');
        });

        dragDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDropArea.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });

        // Click to trigger file input
        dragDropArea.addEventListener('click', () => {
            fileInput.click();
        });
    }

    async handleFiles(files) {
        const svgFiles = Array.from(files).filter(file => 
            file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
        );

        if (svgFiles.length === 0) {
            alert('Please select valid SVG files.');
            return;
        }

        const resultsSection = document.getElementById('resultsSection');
        const fileResults = document.getElementById('fileResults');
        
        resultsSection.style.display = 'block';
        fileResults.innerHTML = '';

        for (const file of svgFiles) {
            await this.processFile(file);
        }
    }

    async processFile(file) {
        try {
            const originalContent = await this.readFileAsText(file);
            const originalSize = new Blob([originalContent]).size;
            
            const cleanedContent = this.cleanSVG(originalContent);
            const cleanedSize = new Blob([cleanedContent]).size;
            
            const savings = originalSize - cleanedSize;
            const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

            this.displayResult(file.name, originalContent, cleanedContent, originalSize, cleanedSize, savings, savingsPercent);
        } catch (error) {
            console.error('Error processing file:', error);
            this.displayError(file.name, error.message);
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    cleanSVG(svgContent) {
        // Parse the SVG content
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        
        // Check for parsing errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid SVG file');
        }

        const svg = doc.querySelector('svg');
        if (!svg) {
            throw new Error('No SVG element found');
        }

        // Apply cleaning rules
        this.removeUselessMetadata(svg);
        this.removeWidthHeight(svg);
        this.keepViewBox(svg);
        this.flattenGroups(svg);
        this.removeHiddenElements(svg);
        this.collapseTransforms(svg);
        this.cleanupStyles(svg);
        this.cleanupTextContent(svg);
        this.cleanupAttributes(svg);

        // Serialize back to string
        const serializer = new XMLSerializer();
        let cleanedContent = serializer.serializeToString(svg);
        
        // Clean up the XML declaration and format
        cleanedContent = this.formatSVG(cleanedContent);
        
        return cleanedContent;
    }

    removeUselessMetadata(svg) {
        // Remove title, desc, metadata elements
        const metadataSelectors = [
            'title', 'desc', 'metadata', 
            'defs > title', 'defs > desc'
        ];
        
        metadataSelectors.forEach(selector => {
            const elements = svg.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        // Remove editor-specific attributes
        const editorAttributes = [
            'inkscape:version', 'inkscape:export-filename', 'inkscape:export-xdpi',
            'inkscape:export-ydpi', 'sodipodi:docname', 'xmlns:inkscape',
            'xmlns:sodipodi', 'xmlns:rdf', 'xmlns:cc', 'xmlns:dc'
        ];

        this.removeAttributesRecursively(svg, editorAttributes);
        
        // Remove XML comments
        this.removeComments(svg);
    }

    removeWidthHeight(svg) {
        // Remove width and height attributes from root SVG
        svg.removeAttribute('width');
        svg.removeAttribute('height');
    }

    keepViewBox(svg) {
        // Ensure viewBox is preserved - this method just validates it exists
        if (!svg.getAttribute('viewBox')) {
            // If no viewBox but has width/height, try to create one
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            if (width && height) {
                const w = parseFloat(width);
                const h = parseFloat(height);
                if (!isNaN(w) && !isNaN(h)) {
                    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
                }
            }
        }
    }

    flattenGroups(svg) {
        // Find groups that can be flattened (no transforms, styles, or special attributes)
        const groups = svg.querySelectorAll('g');
        
        groups.forEach(group => {
            const hasTransform = group.getAttribute('transform');
            const hasStyle = group.getAttribute('style');
            const hasClass = group.getAttribute('class');
            const hasId = group.getAttribute('id');
            
            // Only flatten simple groups
            if (!hasTransform && !hasStyle && !hasClass && !hasId) {
                // Move children to parent
                const parent = group.parentNode;
                while (group.firstChild) {
                    parent.insertBefore(group.firstChild, group);
                }
                group.remove();
            }
        });
    }

    removeHiddenElements(svg) {
        // Remove elements with display:none or visibility:hidden
        const allElements = svg.querySelectorAll('*');
        
        allElements.forEach(element => {
            const style = element.getAttribute('style') || '';
            const display = element.getAttribute('display');
            const visibility = element.getAttribute('visibility');
            
            if (display === 'none' || 
                visibility === 'hidden' || 
                style.includes('display:none') || 
                style.includes('display: none') ||
                style.includes('visibility:hidden') ||
                style.includes('visibility: hidden')) {
                element.remove();
            }
        });
    }

    collapseTransforms(svg) {
        // This is a simplified transform collapse - in a real implementation
        // you'd want more sophisticated matrix math
        const elementsWithTransform = svg.querySelectorAll('[transform]');
        
        elementsWithTransform.forEach(element => {
            const transform = element.getAttribute('transform');
            if (transform) {
                // Remove redundant transforms like translate(0,0) or scale(1)
                if (transform.includes('translate(0,0)') || 
                    transform.includes('translate(0 0)') ||
                    transform.includes('scale(1)')) {
                    
                    let cleanTransform = transform
                        .replace(/translate\(0[,\s]0\)/g, '')
                        .replace(/scale\(1\)/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    if (cleanTransform) {
                        element.setAttribute('transform', cleanTransform);
                    } else {
                        element.removeAttribute('transform');
                    }
                }
            }
        });
    }

    cleanupStyles(svg) {
        // Remove empty style attributes
        const elementsWithStyle = svg.querySelectorAll('[style]');
        
        elementsWithStyle.forEach(element => {
            const style = element.getAttribute('style');
            if (!style || style.trim() === '') {
                element.removeAttribute('style');
            }
        });
    }

    cleanupTextContent(svg) {
        // Clean up text content in SVG elements
        const textElements = svg.querySelectorAll('text, tspan');
        
        textElements.forEach(element => {
            const textContent = element.textContent;
            if (textContent) {
                // Only remove zero-width characters, preserve other text
                const cleanText = textContent
                    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
                    .trim();
                
                if (cleanText !== textContent) {
                    element.textContent = cleanText;
                }
            }
        });
    }

    cleanupAttributes(svg) {
        // Clean up attribute values that contain non-ASCII characters
        const allElements = svg.querySelectorAll('*');
        
        allElements.forEach(element => {
            const attributes = Array.from(element.attributes);
            
            attributes.forEach(attr => {
                const name = attr.name;
                const value = attr.value;
                
                // Skip essential SVG attributes that might need special characters
                if (['d', 'transform'].includes(name)) {
                    return;
                }
                
                // Clean up IDs, class names, and other text attributes
                if (['id', 'class', 'inkscape:label'].includes(name) || name.includes('aria-') || name.includes('data-')) {
                    const cleanValue = value
                        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
                        .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars with underscore
                        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
                    
                    if (cleanValue && cleanValue !== value) {
                        element.setAttribute(name, cleanValue);
                    } else if (!cleanValue) {
                        // Remove empty attributes
                        element.removeAttribute(name);
                    }
                }
                
                // Clean up URL references like fill="url(#무제_그라디언트)"
                if (value.includes('url(#') && /[^\x00-\x7F]/.test(value)) {
                    const cleanValue = value.replace(/url\(#([^)]+)\)/g, (match, id) => {
                        const cleanId = id
                            .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
                            .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars with underscore
                            .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                            .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
                        
                        return cleanId ? `url(#${cleanId})` : 'none';
                    });
                    
                    if (cleanValue !== value) {
                        element.setAttribute(name, cleanValue);
                    }
                }
            });
        });
        
        // Clean up CSS content in style elements
        this.cleanupStyleElements(svg);
        
        // Update any referenced IDs to match the cleaned versions
        this.updateReferences(svg);
    }

    cleanupStyleElements(svg) {
        // Clean up content inside <style> elements
        const styleElements = svg.querySelectorAll('style');
        
        styleElements.forEach(styleElement => {
            let cssContent = styleElement.textContent || styleElement.innerHTML;
            
            if (cssContent && /[^\x00-\x7F]/.test(cssContent)) {
                // Clean up CSS selector names and URL references
                cssContent = cssContent.replace(/url\(#([^)]+)\)/g, (match, id) => {
                    const cleanId = id
                        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
                        .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars with underscore
                        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
                    
                    return cleanId ? `url(#${cleanId})` : 'none';
                });
                
                // Clean up class names that might contain non-ASCII characters
                cssContent = cssContent.replace(/\.([a-zA-Z_][a-zA-Z0-9_\u00A0-\uFFFF-]*)/g, (match, className) => {
                    const cleanClassName = className
                        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
                        .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars with underscore
                        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
                    
                    return cleanClassName ? `.${cleanClassName}` : '';
                });
                
                styleElement.textContent = cssContent;
            }
        });
    }

    updateReferences(svg) {
        // Create a mapping of old IDs to new cleaned IDs
        const idMapping = new Map();
        const elementsWithId = svg.querySelectorAll('[id]');
        
        elementsWithId.forEach(element => {
            const originalId = element.getAttribute('id');
            const cleanId = originalId
                .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
                .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars with underscore
                .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
            
            if (cleanId && cleanId !== originalId) {
                idMapping.set(originalId, cleanId);
                element.setAttribute('id', cleanId);
            } else if (!cleanId) {
                element.removeAttribute('id');
            }
        });
        
        // Update all references to the changed IDs in attributes
        if (idMapping.size > 0) {
            const allElements = svg.querySelectorAll('*');
            allElements.forEach(element => {
                const attributes = Array.from(element.attributes);
                
                attributes.forEach(attr => {
                    let value = attr.value;
                    let updated = false;
                    
                    // Update URL references
                    idMapping.forEach((newId, oldId) => {
                        const oldRef = `url(#${oldId})`;
                        const newRef = `url(#${newId})`;
                        if (value.includes(oldRef)) {
                            value = value.replace(new RegExp(oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newRef);
                            updated = true;
                        }
                        
                        // Update href references
                        const oldHref = `#${oldId}`;
                        const newHref = `#${newId}`;
                        if (value === oldHref) {
                            value = newHref;
                            updated = true;
                        }
                    });
                    
                    if (updated) {
                        element.setAttribute(attr.name, value);
                    }
                });
            });
            
            // Update references in style elements
            const styleElements = svg.querySelectorAll('style');
            styleElements.forEach(styleElement => {
                let cssContent = styleElement.textContent;
                let updated = false;
                
                idMapping.forEach((newId, oldId) => {
                    const oldRef = `url(#${oldId})`;
                    const newRef = `url(#${newId})`;
                    
                    // Escape special characters for regex
                    const escapedOldRef = oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedOldRef, 'g');
                    
                    if (cssContent.includes(oldRef)) {
                        cssContent = cssContent.replace(regex, newRef);
                        updated = true;
                    }
                });
                
                if (updated) {
                    styleElement.textContent = cssContent;
                }
            });
        }
    }

    removeAttributesRecursively(element, attributes) {
        // Remove specified attributes from element and all children
        attributes.forEach(attr => {
            element.removeAttribute(attr);
        });
        
        Array.from(element.children).forEach(child => {
            this.removeAttributesRecursively(child, attributes);
        });
    }

    removeComments(svg) {
        // Remove XML comments
        const walker = document.createTreeWalker(
            svg,
            NodeFilter.SHOW_COMMENT,
            null,
            false
        );
        
        const comments = [];
        let node;
        while (node = walker.nextNode()) {
            comments.push(node);
        }
        
        comments.forEach(comment => comment.remove());
    }

    formatSVG(svgString) {
        // Clean up the SVG string formatting
        let cleanedString = svgString
            .replace(/^\s*<\?xml[^>]*\?>\s*/, '') // Remove XML declaration
            .replace(/>\s+</g, '><') // Remove whitespace between tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
            .trim();
        
        return cleanedString;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    displayResult(fileName, originalContent, cleanedContent, originalSize, cleanedSize, savings, savingsPercent) {
        const fileResults = document.getElementById('fileResults');
        
        const resultDiv = document.createElement('div');
        resultDiv.className = 'file-result';
        
        // Create unique IDs for this file result
        const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        resultDiv.innerHTML = `
            <h4>
                [FILE] ${fileName}
                <span style="color: #28a745; font-size: 0.9em;">
                    ${savings > 0 ? '[OK] Optimized' : '[WARN] No savings'}
                </span>
            </h4>
            
            <div class="file-stats">
                <div class="stat">
                    <div class="stat-label">Original Size</div>
                    <div class="stat-value">${this.formatFileSize(originalSize)}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Cleaned Size</div>
                    <div class="stat-value">${this.formatFileSize(cleanedSize)}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Savings</div>
                    <div class="stat-value savings">
                        ${this.formatFileSize(savings)} (${savingsPercent}%)
                    </div>
                </div>
            </div>
            
            <div class="before-after">
                <div class="preview-section">
                    <h5>Original SVG</h5>
                    <div class="svg-preview" id="${fileId}_original_preview">
                        <!-- Original SVG will be inserted here -->
                    </div>
                    <div class="code-preview">
                        <h6>Code (${originalContent.length} chars)</h6>
                        <pre>${this.escapeHtml(originalContent)}</pre>
                    </div>
                </div>
                <div class="preview-section">
                    <h5>Cleaned SVG</h5>
                    <div class="svg-preview" id="${fileId}_cleaned_preview">
                        <!-- Cleaned SVG will be inserted here -->
                    </div>
                    <div class="code-preview">
                        <h6>Code (${cleanedContent.length} chars)</h6>
                        <pre>${this.escapeHtml(cleanedContent)}</pre>
                    </div>
                </div>
            </div>
            
            <button class="download-btn" onclick="svgCleaner.downloadFile('${fileName}', \`${cleanedContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">
                [DOWNLOAD] Download Cleaned SVG
            </button>
        `;
        
        fileResults.appendChild(resultDiv);
        
        // Insert actual SVG previews
        this.insertSVGPreview(fileId + '_original_preview', originalContent);
        this.insertSVGPreview(fileId + '_cleaned_preview', cleanedContent);
    }

    displayError(fileName, errorMessage) {
        const fileResults = document.getElementById('fileResults');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'file-result';
        errorDiv.style.borderColor = '#dc3545';
        errorDiv.style.backgroundColor = '#f8d7da';
        
        errorDiv.innerHTML = `
            <h4>[ERROR] ${fileName}</h4>
            <p style="color: #721c24; margin: 10px 0;">
                Error: ${errorMessage}
            </p>
        `;
        
        fileResults.appendChild(errorDiv);
    }

    insertSVGPreview(previewId, svgContent) {
        const previewElement = document.getElementById(previewId);
        if (!previewElement) return;
        
        try {
            // Clean the SVG content for preview
            let cleanContent = svgContent.trim();
            
            // Parse the SVG to ensure it's valid
            const parser = new DOMParser();
            const doc = parser.parseFromString(cleanContent, 'image/svg+xml');
            const parseError = doc.querySelector('parsererror');
            
            if (parseError) {
                previewElement.innerHTML = '<div style="color: #dc3545; padding: 20px; font-size: 0.9em;">Invalid SVG</div>';
                return;
            }
            
            const svg = doc.querySelector('svg');
            if (!svg) {
                previewElement.innerHTML = '<div style="color: #dc3545; padding: 20px; font-size: 0.9em;">No SVG found</div>';
                return;
            }
            
            // Clone the SVG and ensure it has proper sizing for preview
            const svgClone = svg.cloneNode(true);
            
            // Remove any width/height and ensure proper viewBox for preview
            svgClone.removeAttribute('width');
            svgClone.removeAttribute('height');
            svgClone.style.width = '100%';
            svgClone.style.height = '100%';
            svgClone.style.maxWidth = '100%';
            svgClone.style.maxHeight = '60px';
            
            // Ensure the SVG has a viewBox for proper scaling
            if (!svgClone.getAttribute('viewBox')) {
                svgClone.setAttribute('viewBox', '0 0 100 100');
            }
            
            previewElement.innerHTML = '';
            previewElement.appendChild(svgClone);
            
        } catch (error) {
            console.error('Error creating SVG preview:', error);
            previewElement.innerHTML = '<div style="color: #dc3545; padding: 20px; font-size: 0.9em;">Preview error: ' + error.message + '</div>';
        }
    }

    downloadFile(fileName, content) {
        const blob = new Blob([content], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace('.svg', '_cleaned.svg');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the SVG cleaner when the page loads
const svgCleaner = new SVGCleaner();