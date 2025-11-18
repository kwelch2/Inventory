// modules/ui/management.js
import { state } from "../state.js";
import { $, escapeHtml } from "../helpers/utils.js";
import { openVendorModal, openMgmtEditModal } from "./modals.js";

export function renderUnits() {
    $('#kvUnits').textContent = `(${state.units.length})`;
    const rows = state.units.map(u => `
        <tr>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.id)}</td>
            <td>
                <button class="btn btn-small" data-edit-collection="units" data-edit-id="${u.id}" data-edit-name="${escapeHtml(u.name)}">Edit</button>
                <button class="btn danger btn-small" data-delete-unit-id="${u.id}">Delete</button>
            </td>
        </tr>`).join('');
    $('#unitsTable').innerHTML = `<div class="row"><input id="newUnitName" placeholder="New Unit Name"><button id="addUnitBtn" class="btn primary">Add Unit</button></div><table><thead><tr><th>Name</th><th>ID</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderCompartments() {
    $('#kvCompartments').textContent = `(${state.compartments.length})`;
    const rows = state.compartments.map(c => `
        <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>
                <button class="btn btn-small" data-edit-collection="compartments" data-edit-id="${c.id}" data-edit-name="${escapeHtml(c.name)}">Edit</button>
                <button class="btn danger btn-small" data-delete-comp-id="${c.id}">Delete</button>
            </td>
        </tr>`).join('');
    $('#compartmentsTable').innerHTML = `<div class="row"><input id="newCompName" placeholder="New Compartment Name"><button id="addCompBtn" class="btn primary">Add Compartment</button></div><table><thead><tr><th>Name</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderCategories() {
    $('#kvCategories').textContent = `(${state.categories.length})`;
    const rows = state.categories.map(c => `
        <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>
                <button class="btn btn-small" data-edit-collection="categories" data-edit-id="${c.id}" data-edit-name="${escapeHtml(c.name)}">Edit</button>
                <button class="btn danger btn-small" data-delete-category-id="${c.id}">Delete</button>
            </td>
        </tr>`).join('');
    $('#categoriesTable').innerHTML = `<div class="row"><input id="newCategoryName" placeholder="New Category Name"><button id="addCategoryBtn" class="btn primary">Add Category</button></div><table><thead><tr><th>Name</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderVendors() {
    $('#kvVendors').textContent = `(${state.vendors.length})`;
    const rows = state.vendors.map(v => `
        <tr>
            <td><strong>${escapeHtml(v.name)}</strong></td>
            <td>${escapeHtml(v.contactEmail || v.email || '')}</td>
            <td>${escapeHtml(v.contactPhone || v.phone || '')}</td>
            <td>${v.weburl ? `<a href="${v.weburl.startsWith('http') ? '' : '//'}${escapeHtml(v.weburl)}" target="_blank">Website</a>` : ''}</td>
            <td>
                <button class="btn btn-small" data-edit-vendor-id="${v.id}">Edit</button>
                <button class="btn danger btn-small" data-delete-vendor-id="${v.id}">Delete</button>
            </td>
        </tr>`).join('');
    $('#vendorsTableContainer').innerHTML = `
        <table>
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Link</th><th>Actions</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}