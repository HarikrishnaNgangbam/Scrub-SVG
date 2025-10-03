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

        const fileResults = document.getElementById('fileResults');
        
        fileResults.style.display = 'block';
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
            <div class="before-after">
            <div class="preview-section">
            <h5>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 8px;">
                <path d="M22 22v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9v2H4v22h16v-6z"/>
                <path d="M29.537 5.76 26.24 2.463a1.58 1.58 0 0 0-2.236 0L14 12.467V18h5.533L29.537 7.996a1.58 1.58 0 0 0 0-2.236zM18.533 16H16v-2.533l7.467-7.467 2.533 2.533z"/>
            </svg>
            Original SVG
            </h5>
            <div class="file-info">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 8px;">
                <path d="M25.7 9.3l-7-7A.908.908 0 0 0 18 2H8a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10a.908.908 0 0 0-.3-.7zM18 4.4l5.6 5.6H18zM8 28V4h8v8h8v16z"/>
            </svg>
            <span class="file-name">${this.escapeHtml(fileName)}</span>
            </div>
            <div class="tab-container">
            <button class="tab-button active" onclick="svgCleaner.switchTab('${fileId}_original', 'preview')">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 6px;">
                <path d="M30.94 15.66A16.69 16.69 0 0 0 16 5A16.69 16.69 0 0 0 1.06 15.66a1 1 0 0 0 0 .68A16.69 16.69 0 0 0 16 27a16.69 16.69 0 0 0 14.94-10.66 1 1 0 0 0 0-.68zM16 25c-5.3 0-10.9-3.93-12.93-9C5.1 10.93 10.7 7 16 7s10.9 3.93 12.93 9C26.9 21.07 21.3 25 16 25z"/>
                <path d="M16 10a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/>
                </svg>
                Preview
            </button>
            <button class="tab-button" onclick="svgCleaner.switchTab('${fileId}_original', 'code')">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 6px;">
                <path d="M31 16L24 9v4H16v6h8v4zM1 16l7-7v4h8v6H8v4z"/>
                </svg>
                Code
            </button>
            </div>
            <div class="tab-content active" id="${fileId}_original_preview_tab">
            <div class="svg-preview" id="${fileId}_original_preview">
                <!-- Original SVG will be inserted here -->
            </div>
            </div>
            <div class="tab-content" id="${fileId}_original_code_tab">
            <div class="code-preview">
                <h6>Original Code (${originalContent.length} chars)</h6>
                <pre>${this.escapeHtml(originalContent)}</pre>
            </div>
            </div>
            </div>
            <div class="preview-section">
            <h5>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 8px;">
                <path d="M13.5 22.142 9.356 18l-1.414 1.414L13.5 25l11.308-11.308L23.394 12 13.5 22.142z"/>
            </svg>
            Cleaned SVG
            </h5>
            <div class="cta-section">
            <button class="cta-btn copy-btn" onclick="svgCleaner.copyToClipboard(\`${this.escapeHtml(cleanedContent)}\`)">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 6px;">
                <path d="M28 10v18H10V10h18m0-2H10a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z"/>
                <path d="M4 18H2V4a2 2 0 0 1 2-2h14v2H4v14z"/>
                </svg>
                Copy Code
            </button>
            <button class="cta-btn download-btn-inline" onclick="svgCleaner.downloadFile('${this.escapeHtml(fileName)}', \`${this.escapeHtml(cleanedContent)}\`)">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 6px;">
                <path d="M26 24v4H6v-4H4v4a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-4zM26 14l-1.41-1.41L17 20.17V2h-2v18.17l-7.59-7.58L6 14l10 10 10-10z"/>
                </svg>
                Download SVG
            </button>
            </div>
            <div class="tab-container">
            <button class="tab-button active" onclick="svgCleaner.switchTab('${fileId}_cleaned', 'preview')">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 6px;">
                <path d="M30.94 15.66A16.69 16.69 0 0 0 16 5A16.69 16.69 0 0 0 1.06 15.66a1 1 0 0 0 0 .68A16.69 16.69 0 0 0 16 27a16.69 16.69 0 0 0 14.94-10.66 1 1 0 0 0 0-.68zM16 25c-5.3 0-10.9-3.93-12.93-9C5.1 10.93 10.7 7 16 7s10.9 3.93 12.93 9C26.9 21.07 21.3 25 16 25z"/>
                <path d="M16 10a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/>
                </svg>
                Preview
            </button>
            <button class="tab-button" onclick="svgCleaner.switchTab('${fileId}_cleaned', 'code')">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 6px;">
                <path d="M31 16L24 9v4H16v6h8v4zM1 16l7-7v4h8v6H8v4z"/>
                </svg>
                Code
            </button>
            </div>
            <div class="tab-content active" id="${fileId}_cleaned_preview_tab">
            <div class="svg-preview" id="${fileId}_cleaned_preview">
                <!-- Cleaned SVG will be inserted here -->
            </div>
            </div>
            <div class="tab-content" id="${fileId}_cleaned_code_tab">
            <div class="code-preview">
                <h6>Cleaned Code (${cleanedContent.length} chars)</h6>
                <pre>${this.escapeHtml(cleanedContent)}</pre>
            </div>
            </div>
            </div>
            </div>
            
            <div class="file-stats">
            <div class="stat">
            <div class="stat-label">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 4px;">
                <path d="M25.7 9.3l-7-7A.908.908 0 0 0 18 2H8a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10a.908.908 0 0 0-.3-.7zM18 4.4l5.6 5.6H18zM8 28V4h8v8h8v16z"/>
            </svg>
            Original Size
            </div>
            <div class="stat-value">${this.formatFileSize(originalSize)}</div>
            </div>
            <div class="stat">
            <div class="stat-label">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 4px;">
                <path d="M13.5 22.142 9.356 18l-1.414 1.414L13.5 25l11.308-11.308L23.394 12 13.5 22.142z"/>
            </svg>
            Cleaned Size
            </div>
            <div class="stat-value">${this.formatFileSize(cleanedSize)}</div>
            </div>
            <div class="stat">
            <div class="stat-label">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="margin-right: 4px;">
                <path d="M16 8l-1.43 1.393L20.15 15H8v2h12.15l-5.58 5.607L16 24l8-8-8-8z"/>
            </svg>
            Savings
            </div>
            <div class="stat-value savings">
            ${this.formatFileSize(savings)} (${savingsPercent}%)
            </div>
            </div>
            </div>
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
            
            // Remove any width/height and set proper styles for preview
            svgClone.removeAttribute('width');
            svgClone.removeAttribute('height');
            svgClone.style.width = 'auto';
            svgClone.style.height = 'auto';
            svgClone.style.maxWidth = '100%';
            svgClone.style.maxHeight = '100%';
            
            // Ensure the SVG has a viewBox for proper scaling
            if (!svgClone.getAttribute('viewBox')) {
                // Try to get dimensions from original attributes or set default
                const originalWidth = svg.getAttribute('width') || '100';
                const originalHeight = svg.getAttribute('height') || '100';
                const w = parseFloat(originalWidth);
                const h = parseFloat(originalHeight);
                if (!isNaN(w) && !isNaN(h)) {
                    svgClone.setAttribute('viewBox', `0 0 ${w} ${h}`);
                } else {
                    svgClone.setAttribute('viewBox', '0 0 100 100');
                }
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

    async copyToClipboard(content) {
        try {
            await navigator.clipboard.writeText(content);
            // Show temporary feedback
            const copyBtns = document.querySelectorAll('.copy-btn');
            copyBtns.forEach(btn => {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.background = '#059669';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            });
        } catch (err) {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = content;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    switchTab(panelId, tabType) {
        // Get all tab buttons for this panel
        const previewTabButton = document.querySelector(`[onclick*="${panelId}"][onclick*="preview"]`);
        const codeTabButton = document.querySelector(`[onclick*="${panelId}"][onclick*="code"]`);
        
        // Get all tab content containers for this panel
        const previewTabContent = document.getElementById(`${panelId}_preview_tab`);
        const codeTabContent = document.getElementById(`${panelId}_code_tab`);
        
        if (tabType === 'preview') {
            // Show preview tab
            previewTabButton.classList.add('active');
            codeTabButton.classList.remove('active');
            previewTabContent.classList.add('active');
            codeTabContent.classList.remove('active');
        } else if (tabType === 'code') {
            // Show code tab
            codeTabButton.classList.add('active');
            previewTabButton.classList.remove('active');
            codeTabContent.classList.add('active');
            previewTabContent.classList.remove('active');
        }
    }
}

// Initialize the SVG cleaner when the page loads
const svgCleaner = new SVGCleaner();