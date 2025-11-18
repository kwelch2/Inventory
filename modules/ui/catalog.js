// modules/ui/catalog.js
import { state } from "../state.js";
import { $, eescapeHtml, exportToCsv, downloadCsv} from "../helpers/utils.js";
import { openCatalogModal, openPricingModal } from "./modals.js"; // <-- Removed openLabelModal

export function renderCatalog() {
    const container = $("#catalogTableContainer");
    if (!container) return; 
    
    const query = $('#catSearch').value.toLowerCase();
    
    const filtered = state.catalog.filter(i => 
        (i.itemName || '').toLowerCase().includes(query) || 
        (Array.isArray(i.itemNameAlt) ? i.itemNameAlt.join(' ') : (i.itemNameAlt || '')).toLowerCase().includes(query)
    );

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
            .map(p => ({...p, vendorName: state.vendorMap.get(p.vendorId) || 'N/A'}))
            .sort((a,b) => (a.unitPrice || Infinity) - (b.unitPrice || Infinity));
        
        const cheapestPrice = allPrices[0];
        
        const pricesHtml = allPrices.length > 0 ? allPrices.map(p => {
            let classes = 'price-tag';
            if (p.vendorId === item.preferredVendorId) classes += ' preferred-price';
            if (p.vendorId === cheapestPrice?.vendorId) classes += ' best-price';
            
            return `<span class="${classes}">
                ${escapeHtml(p.vendorName)}: $${(p.unitPrice || 0).toFixed(2)}
                <button class="btn btn-small" data-edit-price-id="${p.id}" style="margin-left: 8px; padding: 2px 6px; font-size: 0.7rem;">Edit</button>
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

// Setup event listeners for the catalog panel
export function setupCatalogPanel() {
    $('#catalogTableContainer').addEventListener('click', e => {
        const target = e.target;
        
        if (target.dataset.editItemId) {
            openCatalogModal(target.dataset.editItemId);
            return;
        }
        
        // --- REMOVED: data-label-item-id listener ---
        
        if (target.dataset.addPriceForId) {
            openPricingModal(null, target.dataset.addPriceForId);
            return;
        }

        if (target.dataset.editPriceId) {
            openPricingModal(target.dataset.editPriceId);
            return;
        }
    });

    $('#catSearch').addEventListener('input', renderCatalog);
    $('#showCatalogModal').addEventListener('click', () => openCatalogModal());

    // --- NEW: Wire up the Export Button ---
    $('#exportLabelsCsvBtn').addEventListener('click', () => {
        // 1. Get only active items from the catalog
        const itemsToExport = state.catalog
            .filter(item => item.isActive !== false)
            .map(item => ({
                itemName: item.itemName,
                itemRef: item.itemRef || '',
                parLevel: item.parLevel || 0
            }));
            
        if (itemsToExport.length === 0) {
            alert("No active catalog items to export.");
            return;
        }

        // 2. Define the columns for the mail merge
        const columns = ['itemName', 'itemRef', 'parLevel'];
        
        // 3. Convert to CSV string
        const csvString = exportToCsv(itemsToExport, columns);
        
        // 4. Trigger download
        downloadCsv(csvString, 'ems_supply_labels.csv');
    });
}