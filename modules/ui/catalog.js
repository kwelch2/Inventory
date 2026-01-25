// modules/ui/catalog.js
import { state } from "../state.js";
import { $, escapeHtml, exportToCsv, downloadCsv, debounce } from "../helpers/utils.js";
import { openCatalogModal, openPricingModal, openExportModal } from "./modals.js";

/**
 * Renders the catalog table with filtering and sorting
 */
export function renderCatalog() {
    const container = $("#catalogTableContainer");
    if (!container) return; 
    
    const query = $('#catSearch').value.toLowerCase();
    const categoryFilter = $('#catFilterCategory') ? $('#catFilterCategory').value : 'all';
    
    const filtered = state.catalog.filter(i => {
        const searchMatch = (i.itemName || '').toLowerCase().includes(query) || 
            (Array.isArray(i.itemNameAlt) ? i.itemNameAlt.join(' ') : (i.itemNameAlt || '')).toLowerCase().includes(query);
        
        const categoryMatch = (categoryFilter === 'all' || i.category === categoryFilter);
        
        return searchMatch && categoryMatch;
    });

    filtered.sort((a, b) => {
        const aActive = a.isActive !== false;
        const bActive = b.isActive !== false;
        if (aActive !== bActive) {
            return aActive ? -1 : 1;
        }
        return (a.itemName || '').toLowerCase().localeCompare((b.itemName || '').toLowerCase());
    });
    
    $('#kvCatalog').textContent = `(${filtered.length})`;

    const rows = filtered.map(item => {
        const categoryName = state.categoryMap.get(item.category) || item.category || 'N/A';
        const isActive = item.isActive !== false;
        
        const allPrices = (state.pricingMap.get(item.id) || [])
    .map(p => {
        const v = state.vendors.find(ven => ven.id === p.vendorId);
        const fee = v?.serviceFee || 0;
        return {
            ...p, 
            vendorName: v?.name || 'N/A',
            effectivePrice: (p.unitPrice || 0) * (1 + (fee/100))
        };
    })
    .sort((a,b) => a.effectivePrice - b.effectivePrice);

const cheapestPrice = allPrices[0];

const pricesHtml = allPrices.length > 0 ? allPrices.map(p => {
    let classes = 'price-tag';
    if (p.vendorId === item.preferredVendorId) classes += ' preferred-price';
    if (p.vendorId === cheapestPrice?.vendorId) classes += ' best-price';
    
    return `<span class="${classes}">
        ${escapeHtml(p.vendorName)}: $${p.effectivePrice.toFixed(2)}
        <button class="btn btn-small" data-edit-price-id="${p.id}" ... >Edit</button>
    </span>`;
}).join('') : '<span class="muted">No pricing</span>';
        
        return `
            <tr class="catalog-row" data-catalog-id="${item.id}" style="${isActive ? '' : 'opacity: 0.5;'}">
                <td>
                    <strong class="catalog-item-name" 
                            data-edit-item-id="${item.id}" 
                            style="cursor: pointer; color: var(--accent); text-decoration: ${isActive ? 'none' : 'line-through'};">
                        ${escapeHtml(item.itemName)}
                    </strong>
                </td>
                <td>${escapeHtml(categoryName)}</td>
                <td>${escapeHtml(item.parLevel || 0)}</td>
                <td>${pricesHtml}</td>
                <td>
                    <button class="btn btn-small" data-edit-item-id="${item.id}">Edit Item</button>
                    <button class="btn primary btn-small" data-add-price-for-id="${item.id}">+ Add Price</button>
                    </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>PAR</th>
                    <th style="width: 35%;">Vendor Pricing</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

/**
 * Populates the category filter dropdown
 */
export function populateCategoryFilter() {
    const catSelect = $("#catFilterCategory");
    if (!catSelect) return;
    
    // Preserve selected value if it exists
    const currentVal = catSelect.value;
    
    catSelect.innerHTML = '<option value="all">All Categories</option>' +
        state.categories
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
            .join('');
    
    // Restore selected value
    catSelect.value = currentVal || 'all';
}

/**
 * Sets up event listeners for the catalog panel
 */
export function setupCatalogPanel() {
    $('#catalogTableContainer').addEventListener('click', e => {
        const target = e.target;
        
        if (target.dataset.editItemId) {
            openCatalogModal(target.dataset.editItemId);
            return;
        }
        
        if (target.dataset.addPriceForId) {
            openPricingModal(null, target.dataset.addPriceForId);
            return;
        }

        if (target.dataset.editPriceId) {
            openPricingModal(target.dataset.editPriceId);
            return;
        }
    });

    // Debounce search input for better performance
    const debouncedRender = debounce(renderCatalog, 300);
    $('#catSearch').addEventListener('input', debouncedRender);
    
    const catFilter = $('#catFilterCategory');
    if (catFilter) {
        catFilter.addEventListener('change', renderCatalog);
    }
    
    $('#showCatalogModal').addEventListener('click', () => openCatalogModal());

    // Wire up the Export Button to open the modal
    $('#exportLabelsCsvBtn').addEventListener('click', () => {
        openExportModal();
    });
}