/**
 * Lightweight DOM selector helper
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
export function $(selector) {
    return document.querySelector(selector);
}

/**
 * Selector for multiple elements
 * @param {string} selector - CSS selector
 * @returns {NodeList}
 */
export function $all(selector) {
    return document.querySelectorAll(selector);
}

/**
 * Escape HTML to prevent XSS injection in UI text
 * @param {string} str - String to escape
 * @returns {string}
 */
export function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, m => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
    ));
}

/**
 * Validates and sanitizes user input for safe use
 * @param {string} input - User input to validate
 * @param {Object} options - Validation options
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input, options = {}) {
    const { 
        maxLength = 500, 
        allowNewlines = false,
        trim = true 
    } = options;
    
    let sanitized = String(input || '');
    
    if (trim) {
        sanitized = sanitized.trim();
    }
    
    if (!allowNewlines) {
        sanitized = sanitized.replace(/[\r\n]/g, ' ');
    }
    
    if (maxLength > 0) {
        sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
}

/**
 * Sanitizes a CSV field value
 * @param {*} value - Value to sanitize for CSV
 * @returns {string}
 */
function sanitizeCsvValue(value) {
    const stringValue = String(value == null ? '' : value);
    // If the value contains a comma, newline, or quote, wrap it in double quotes.
    // Also, double up any existing double quotes.
    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

/**
 * Converts an array of objects into a CSV string.
 * @param {Array<Object>} data - The array of data to convert.
 * @param {Array<string>} columns - The specific columns to include, in order.
 * @returns {string}
 */
export function exportToCsv(data, columns) {
    const headers = columns.join(',');
    const rows = data.map(item => {
        return columns.map(col => sanitizeCsvValue(item[col])).join(',');
    });
    
    return [headers, ...rows].join('\r\n');
}

/**
 * Triggers a browser download for a CSV string.
 * @param {string} csvString - The CSV content to download.
 * @param {string} filename - The desired file name.
 */
export function downloadCsv(csvString, filename) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Check for browser support
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up object URL
    }
}

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}