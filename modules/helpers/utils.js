// Lightweight DOM selector helper
export function $(selector) {
    return document.querySelector(selector);
}

// Selector for multiple elements (optional but useful)
export function $all(selector) {
    return document.querySelectorAll(selector);
}

// Escape HTML to prevent accidental injection in UI text
export function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, m => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
    ));
}
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
    }
}