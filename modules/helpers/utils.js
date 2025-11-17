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
