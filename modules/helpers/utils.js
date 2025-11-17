// modules/helpers/utils.js

export const $ = (id) => document.getElementById(id);

export function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

export function dateStamp() {
  const d = new Date();
  return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear().toString().slice(-2)}`;
}
