// modules/ui/orders.js
import { state } from "../state.js";
import { $, escapeHtml } from "../helpers/utils.js";
import { findBestVendor, updateRequestStatus } from "../firestoreApi.js";
import { openChangeVendorModal } from "./modals.js";

// Main render function
export function renderOrders() {
    if (state.orderViewMode === 'vendor') {
        $('#generateItemOrderBtn').style.display = 'none';
        renderOrdersByVendor();
    } else {
        $('#generateItemOrderBtn').style.display = 'inline-block';
        renderOrdersByItem();
    }
}

export function getFilteredRequests() {
    const showHistory = $('#showHistoryToggle').checked;
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.status || 'All';
    
    return state.requests.filter(r => {
        const status = r.status || 'Open';
        const isHistoryStatus = ['Received', 'Completed', 'Closed'].includes(status);
        
        if (showHistory) return isHistoryStatus;
        if (isHistoryStatus) return false; 
        if (activeFilter === 'All') return true;
        return status === activeFilter;
    });
}

// --- HELPER: Handle Unlisted Items ---
function getRequestItemData(r) {
    // Try to find in catalog
    let catItem = state.catalogMap.get(r.catalogId);
    let isUnlisted = false;

    // If not in catalog, create a "Mock" item from the request data
    if (!catItem) {
        if (r.otherItemName) {
            catItem = {
                id: null,
                itemName: r.otherItemName,
                itemRef: 'N/A',
                unit: 'N/A',
                preferredVendorId: null,
                isUnlisted: true
            };
            isUnlisted = true;
        } else {
            return null; // Skip if no name at all
        }
    }

    // Get pricing/vendor info
    const vendorInfo = findBestVendor(r.catalogId, catItem.preferredVendorId, r.overrideVendorId);
    
    // If unlisted, override the vendor name to "Custom Request" unless manually assigned
    if (isUnlisted && !r.overrideVendorId) {
        vendorInfo.vendorName = "Unlisted / Custom Request";
        vendorInfo.vendorId = "unlisted";
    }

    return { catItem, vendorInfo };
}

function renderOrdersByItem() {
    const container = $('#ordersGroupContainer');
    const requestsToProcess = getFilteredRequests();
    
    const sortOrder = { "Open": 1, "Backordered": 2, "Pending": 2, "Ordered": 3 };
    requestsToProcess.sort((a, b) => {
        const itemA = (state.catalogMap.get(a.catalogId)?.itemName || a.otherItemName || 'Z').toLowerCase();
        const itemB = (state.catalogMap.get(b.catalogId)?.itemName || b.otherItemName || 'Z').toLowerCase();
        if (itemA !== itemB) return itemA.localeCompare(itemB);
        const aStatus = a.status || "Open";
        const bStatus = b.status || "Open";
        return (sortOrder[aStatus] || 99) - (sortOrder[bStatus] || 99);
    });

    if (requestsToProcess.length === 0) {
        const msg = $('#showHistoryToggle').checked ? 'No history found.' : 'No active requests found.';
        container.innerHTML = `<p class="muted">${msg}</p>`;
        return;
    }

    if ($('#showHistoryToggle').checked) {
         container.innerHTML = renderHistoryTable(requestsToProcess);
         return;
    }
    
    const tableRows = requestsToProcess.map(r => {
        const data = getRequestItemData(r);
        if (!data) return ''; // Skip invalid
        const { catItem, vendorInfo } = data;
        const status = r.status || 'Open';

        // --- Logic for Price Display ---
        const allPrices = (state.pricingMap.get(catItem.id) || [])
            .map(p => {
                const v = state.vendors.find(ven => ven.id === p.vendorId);
                const fee = v?.serviceFee || 0;
                const effective = (p.unitPrice || 0) * (1 + (fee/100));
                return { ...p, vendorName: v?.name || 'N/A', effectivePrice: effective, hasFee: fee > 0, feePercent: fee };
            })
            .sort((a,b) => a.effectivePrice - b.effectivePrice);
        
        const allPricesHtml = allPrices.length > 0 ? allPrices.map(p => {
            let classes = 'price-tag';
            if (p.vendorId === catItem.preferredVendorId) classes += ' preferred-price';
            
            const priceDisplay = p.hasFee 
                ? `$${p.effectivePrice.toFixed(2)} <span style="font-size:0.8em; color:#666;">(incl. ${p.feePercent}%)</span>`
                : `$${p.effectivePrice.toFixed(2)}`;

            return `<div class="${classes}">
                ${escapeHtml(p.vendorName)}: ${priceDisplay} (#${escapeHtml(p.vendorItemNo)})
            </div>`;
        }).join('') : '<div class="muted">No prices found.</div>';
        
        const isQtyEditable = status === 'Open' || status === 'Backordered';

        return `
            <tr data-request-id="${r.id}">
                <td><input type="checkbox" class="item-order-checkbox" data-request-id="${r.id}"></td>
                <td>
                    <strong>${escapeHtml(catItem.itemName)}</strong> ${catItem.isUnlisted ? '<span class="tag" style="background:#ffeeba;">Unlisted</span>' : ''}
                    <br><span class="muted" style="font-size: 0.8rem;">Ref: ${escapeHtml(catItem.itemRef || 'N/A')}</span>
                    <button class="btn" data-toggle-details style="margin-left: 8px; padding: 2px 6px;">▼</button>
                    <br>
                    <span class="muted">${escapeHtml(vendorInfo.vendorName)}</span>
                </td>
                <td>
                    <input class="quick-qty-edit" type="text" value="${escapeHtml(r.qty)}" 
                           ${isQtyEditable ? '' : 'disabled'}
                           data-request-id="${r.id}" 
                           data-original-value="${escapeHtml(r.qty)}">
                    <span class="muted" style="margin-left: 5px;">${escapeHtml(catItem.unit || '')}</span>
                </td>
                <td>${vendorInfo.vendorItemNo || 'N/A'}</td>
                <td>${vendorInfo.unitPrice ? `$${vendorInfo.unitPrice.toFixed(2)}` : 'N/A'}</td>
                <td>
                    <div class="status-buttons">
                        <button class="btn btn-status ${status === 'Open' ? 'active' : ''}" data-status="Open">Open</button>
                        <button class="btn btn-status ${status === 'Ordered' ? 'active' : ''}" data-status="Ordered">Ordered</button>
                        <button class="btn btn-status ${status === 'Backordered' ? 'active' : ''}" data-status="Backordered">Backordered</button>
                        <button class="btn btn-status-receive" data-status="Received">Received</button>
                    </div>
                    <div class="edit-buttons" style="margin-top: 4px;">
                        ${status === 'Open' ? `<button class="btn btn-small" data-change-vendor-id="${r.id}">Change Vendor</button>` : ''}
                        
                        <button class="btn danger btn-small" data-delete-request-id="${r.id}" style="margin-left: 5px;">Delete</button>
                    </div>
                </td>
            </tr>
            <tr class="details-row" data-details-for="${r.id}">
                <td colspan="6" class="details-cell">
                    <h4>Vendor Pricing</h4>
                    ${allPricesHtml}
                    ${catItem.isUnlisted ? '<p><em>This is a custom request. No catalog pricing available.</em></p>' : ''}
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <table class="vendor-group-table">
            <thead>
                <tr>
                    <th><input type="checkbox" class="item-select-all"></th>
                    <th>Item/Vendor</th>
                    <th>Qty</th>
                    <th>Vendor #</th>
                    <th>Price</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>`;
}

function renderOrdersByVendor() {
    const container = $('#ordersGroupContainer');
    const requestsToProcess = getFilteredRequests();

    const sortOrder = { "Open": 1, "Backordered": 2, "Pending": 2, "Ordered": 3 };
    requestsToProcess.sort((a, b) => {
        const aStatus = a.status || "Open";
        const bStatus = b.status || "Open";
        return (sortOrder[aStatus] || 99) - (sortOrder[bStatus] || 99) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });
    
    if ($('#showHistoryToggle').checked) {
        container.innerHTML = renderHistoryTable(requestsToProcess);
        return;
    }

    const requestsByGroup = new Map();
    for (const r of requestsToProcess) {
        const data = getRequestItemData(r);
        if (!data) continue; // Skip if invalid
        
        const { catItem, vendorInfo } = data;
        const augmentedRequest = { ...r, vendorInfo, catItem };

        let groupId, groupName;
        
        if (r.status === 'Open' || !r.status) {
            if (r.overrideVendorId) {
                groupId = r.overrideVendorId;
                groupName = state.vendorMap.get(r.overrideVendorId) || 'Unknown Vendor';
            } else {
                groupId = vendorInfo.vendorId;
                groupName = vendorInfo.vendorName;
            }
        } else {
            groupId = r.status; // "Ordered" or "Backordered"
            groupName = r.status;
        }

        if (!requestsByGroup.has(groupId)) {
            requestsByGroup.set(groupId, {
                groupName: groupName,
                requests: []
            });
        }
        requestsByGroup.get(groupId).requests.push(augmentedRequest);
    }
    
    container.innerHTML = ''; 
    
    requestsByGroup.forEach((group, groupId) => {
        if (groupId !== 'unassigned' && groupId !== 'unlisted' && groupId !== 'Ordered' && groupId !== 'Backordered' && groupId !== 'Open') {
            renderVendorGroup(container, group, groupId);
        }
    });
    renderVendorGroup(container, requestsByGroup.get('unassigned'), 'unassigned');
    renderVendorGroup(container, requestsByGroup.get('unlisted'), 'unlisted'); 
    renderVendorGroup(container, requestsByGroup.get('Ordered'), 'Ordered');
    renderVendorGroup(container, requestsByGroup.get('Backordered'), 'Backordered');

    if (requestsToProcess.length === 0) {
         container.innerHTML = `<p class="muted">No active requests found.</p>`;
    }
}

export function renderHistoryTable(requests) {
    if (requests.length === 0) return `<p class="muted">No history found.</p>`;
    
    requests.sort((a,b) => (b.receivedAt?.seconds || b.updatedAt?.seconds || 0) - (a.receivedAt?.seconds || a.updatedAt?.seconds || 0));

    const rows = requests.map(r => {
        const catItem = state.catalogMap.get(r.catalogId);
        const itemName = catItem ? catItem.itemName : (r.otherItemName || 'Unknown');
        const receivedDate = r.receivedAt ? new Date(r.receivedAt.seconds * 1000).toLocaleDateString() : (r.updatedAt ? new Date(r.updatedAt.seconds * 1000).toLocaleDateString() : 'N/A');
        return `
            <tr>
                <td><strong>${escapeHtml(itemName)}</strong><br><span class="muted">${escapeHtml(r.requesterEmail)}</span></td>
                <td>${escapeHtml(r.qty)} ${escapeHtml(catItem?.unit || '')}</td>
                <td>${escapeHtml(r.status)}</td>
                <td>${receivedDate}</td>
            </tr>`;
    }).join('');
    
    return `
        <table>
            <thead><tr><th>Item/Requester</th><th>Qty</th><th>Status</th><th>Date Received</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function renderVendorGroup(container, group, vendorId) {
    if (!group || group.requests.length === 0) return;

    const isOrderableGroup = vendorId && vendorId !== 'Open' && vendorId !== 'Ordered' && vendorId !== 'Backordered' && vendorId !== 'unassigned';
    const groupTitle = group.groupName || 'Unknown Group';

    const tableRows = group.requests.map(r => {
        const status = r.status || 'Open';
        const catItem = r.catItem;
        
        const allPrices = (state.pricingMap.get(catItem.id) || [])
            .map(p => {
                const v = state.vendors.find(ven => ven.id === p.vendorId);
                const fee = v?.serviceFee || 0;
                const effective = (p.unitPrice || 0) * (1 + (fee/100));
                return {
                    ...p, 
                    vendorName: v?.name || 'N/A',
                    effectivePrice: effective,
                    hasFee: fee > 0,
                    feePercent: fee
                };
            })
            .sort((a,b) => a.effectivePrice - b.effectivePrice);
        
        const allPricesHtml = allPrices.length > 0 ? allPrices.map(p => {
            let classes = 'price-tag';
            if (p.vendorId === catItem.preferredVendorId) classes += ' preferred-price';
            
            const priceDisplay = p.hasFee 
                ? `$${p.effectivePrice.toFixed(2)} <span style="font-size:0.8em; color:#666;">(incl. ${p.feePercent}%)</span>`
                : `$${p.effectivePrice.toFixed(2)}`;

            return `<div class="${classes}">
                ${escapeHtml(p.vendorName)}: ${priceDisplay} (#${escapeHtml(p.vendorItemNo)}) - <em>${escapeHtml(p.vendorStatus || 'In Stock')}</em>
            </div>`;
        }).join('') : '<div class="muted">No prices found.</div>';
        
        const isQtyEditable = status === 'Open' || status === 'Backordered';

        return `
            <tr data-request-id="${r.id}">
                ${isOrderableGroup ? `<td><input type="checkbox" class="order-item-checkbox" data-request-id="${r.id}"></td>` : ''}
                <td>
                    <strong>${escapeHtml(r.catItem.itemName)}</strong>
                    <br><span class="muted" style="font-size: 0.8rem;">Ref: ${escapeHtml(r.catItem.itemRef || 'N/A')}</span>
                    <button class="btn" data-toggle-details style="margin-left: 8px; padding: 2px 6px;">▼</button>
                    <br>
                    <span class="muted">${escapeHtml(r.vendorInfo.vendorName)} (${escapeHtml(r.vendorInfo.status)})</span>
                </td>
                <td>
                    <input class="quick-qty-edit" type="text" value="${escapeHtml(r.qty)}" 
                           ${isQtyEditable ? '' : 'disabled'}
                           data-request-id="${r.id}" 
                           data-original-value="${escapeHtml(r.qty)}">
                    <span class="muted" style="margin-left: 5px;">${escapeHtml(catItem.unit || 'Each')}</span>
                </td>
                <td>${escapeHtml(r.vendorInfo.vendorItemNo || 'N/A')}</td>
                <td>${r.vendorInfo.unitPrice ? `$${r.vendorInfo.unitPrice.toFixed(2)}` : 'N/A'}</td>
                <td>
                    <div class="status-buttons">
                        <button class="btn btn-status ${status === 'Open' ? 'active' : ''}" data-status="Open">Open</button>
                        <button class="btn btn-status ${status === 'Ordered' ? 'active' : ''}" data-status="Ordered">Ordered</button>
                        <button class="btn btn-status ${status === 'Backordered' ? 'active' : ''}" data-status="Backordered">Backordered</button>
                        <button class="btn btn-status-receive" data-status="Received">Received</button>
                    </div>
                    <div class="edit-buttons" style="margin-top: 4px;">
                        ${status === 'Open' ? `<button class="btn btn-small" data-change-vendor-id="${r.id}">Change Vendor</button>` : ''}
                        
                        <button class="btn danger btn-small" data-delete-request-id="${r.id}" style="margin-left: 5px;">Delete</button>
                    </div>
                </td>
            </tr>
            <tr class="details-row" data-details-for="${r.id}">
                <td colspan="${isOrderableGroup ? 7 : 6}" class="details-cell">
                    <h4>All Vendor Pricing for ${escapeHtml(r.catItem.itemName)}</h4>
                    ${allPricesHtml}
                </td>
            </tr>`;
    }).join('');

    const headerActions = isOrderableGroup ? `
        <div class="row" style="margin-bottom: 0;">
            <label style="font-weight: normal; font-size: 0.9rem; margin-right: 1rem;">
                <input type="checkbox" class="vendor-select-all" data-vendor-id="${vendorId}"> Select All
            </label>
            <button class="btn primary btn-small generate-order-btn" data-vendor-id="${vendorId}" data-vendor-name="${escapeHtml(groupTitle)}">Generate Order for ${escapeHtml(groupTitle)}</button>
        </div>` : '';

    container.innerHTML += `
        <div class="vendor-group" data-group-vendor-id="${vendorId}">
            <div class="vendor-group-header">
                <h3>${escapeHtml(groupTitle)} (${group.requests.length})</h3>
                ${headerActions}
            </div>
            <table class="vendor-group-table">
                <thead>
                    <tr>
                        ${isOrderableGroup ? `<th><input type="checkbox" class="vendor-select-all" data-vendor-id="${vendorId}"></th>` : ''}
                        <th>Item/Vendor</th>
                        <th>Qty</th>
                        <th>Vendor #</th>
                        <th>Price</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>`;
}
