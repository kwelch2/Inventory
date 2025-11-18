// modules/ui/modals.js
import { 
  doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc 
} from "../firebase.js"; // <--- CHANGED
import { db } from "../firebase.js"; // <--- db is still imported from here
import { state } from "../state.js";
import { $, escapeHtml, exportToCsv, downloadCsv } from "../helpers/utils.js";
import { initializeStaticData, findBestVendor } from "../firestoreApi.js";
import { applyPermissions } from "../auth.js";

let addItemChoices;
let isScannerActive = false;
let currentRequestIdToChange = null; // For vendor override modal
let currentVendorId = null; // For editing vendors
let currentMgmtEdit = { collection: null, id: null }; // For generic mgmt edit modal
let currentCatalogItemId = null;
let currentCatalogItem = null;
let currentPriceId = null;
let currentCatalogIdForPricing = null;

// --- Date Helper ---
const getFormattedDate = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}-${dd}-${yy}`;
};

// --- List Helpers ---
function setupListInput(listContainerEl, inputEl, addBtnEl, listArray) {
    listContainerEl.innerHTML = '';
    (listArray || []).forEach(item => addListItem(listContainerEl, item));
    
    addBtnEl.onclick = () => {
        const value = inputEl.value.trim();
        if (value) {
            addListItem(listContainerEl, value);
            inputEl.value = '';
        }
    };
    
    listContainerEl.onclick = (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.classList.contains('danger')) {
             e.target.parentElement.remove();
        }
    };
}

function addListItem(listContainerEl, value) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `<span class="list-item-text">${escapeHtml(value)}</span><button type="button" class="btn danger" style="padding: 2px 6px;">&times;</button>`;
    listContainerEl.appendChild(el);
    applyPermissions(state.userRole);
}

function getListItems(listContainerEl) {
    return Array.from(listContainerEl.querySelectorAll('.list-item-text')).map(el => el.textContent);
}

// --- Barcode Scanner ---
function startScanner(targetInput, viewportElement) {
    if (isScannerActive) {
        Quagga.stop();
        isScannerActive = false;
        viewportElement.style.display = 'none';
        return;
    }
    viewportElement.style.display = 'block';
    Quagga.init({ inputStream: { name: "Live", type: "LiveStream", target: viewportElement, constraints: { facingMode: "environment" } }, decoder: { readers: ["code_128_reader", "ean_reader", "upc_reader"] }}, (err) => {
        if (err) { console.error("Quagga Error:", err); viewportElement.style.display = 'none'; return; }
        Quagga.start();
        isScannerActive = true;
    });
    Quagga.onDetected(result => {
        Quagga.stop();
        isScannerActive = false;
        viewportElement.style.display = 'none';
        if (result && result.codeResult) targetInput.value = result.codeResult.code;
    });
}

// --- Unsaved Changes Check ---
function hasUnsavedCatalogChanges() {
    if (!currentCatalogItem) return false;
    
    const item = currentCatalogItem;
    const formItemName = $('#editItemName').value;
    const formItemRef = $('#editItemRef').value;
    const formUnit = $('#editUnit').value;
    const formPackSize = Number($('#editPackSize').value) || 1;
    const formParLevel = Number($('#editParLevel').value) || 0;
    const formCategory = $('#editCategorySelect').value;
    
    if (formItemName !== (item.itemName || '')) return true;
    if (formItemRef !== (item.itemRef || '')) return true;
    if (formUnit !== (item.unit || '')) return true;
    if (formPackSize !== (item.packSize || 1)) return true;
    if (formParLevel !== (item.parLevel || 0)) return true;
    if (formCategory !== (item.category || '')) return true;
    
    const altNameArray = Array.isArray(item.itemNameAlt) ? item.itemNameAlt : (item.itemNameAlt ? [item.itemNameAlt] : []);
    const barcodeArray = Array.isArray(item.barcode) ? item.barcode : (item.barcode ? [item.barcode] : []);
    const formAltNames = getListItems($('#altNameList'));
    const formBarcodes = getListItems($('#barcodeList'));

    if (formAltNames.length !== altNameArray.length || formAltNames.some((val, i) => val !== altNameArray[i])) return true;
    if (formBarcodes.length !== barcodeArray.length || formBarcodes.some((val, i) => val !== barcodeArray[i])) return true;

    return false; // No changes detected
}


// --- Modal: Add Item to Order ---
export function setupAddItemToOrderModal() {
    const modal = $('#addItemToOrderModal');
    const itemElement = $('#addItemSelect');
    const showModalBtn = $('#showAddItemModal'); // <-- Get element
    const saveBtn = $('#saveAddItemBtn'); // <-- Get element

    // --- SAFETY CHECK ---
    // If these elements don't exist, stop the function.
    if (!modal || !itemElement || !showModalBtn || !saveBtn) {
        console.warn("Could not find 'Add Item to Order' modal elements.");
        return; // Exit function early
    }
    // --- END CHECK ---

    if (addItemChoices) addItemChoices.destroy();
    addItemChoices = new Choices(itemElement, { 
        searchEnabled: true, 
        placeholderValue: 'Select an item to add...',
        searchResultLimit: 100 
    });

    showModalBtn.addEventListener('click', () => { // <-- Use variable
        const options = state.catalog.filter(c=>c.isActive !== false).map(c=>({value: c.id, label: c.itemName}));
        addItemChoices.setChoices(options, 'value', 'label', true);
        modal.style.display = 'flex';
    });

    saveBtn.addEventListener('click', async () => { // <-- Use variable
        const catalogId = addItemChoices.getValue(true);
        const qty = $('#addItemQty').value;
        if (!catalogId || !qty) return alert('Please select an item and quantity.');
        if (!state.user || !state.user.email) return alert('Cannot add item: user is not properly logged in.');
        const payload = { catalogId, qty, status: 'Open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), requesterEmail: state.user.email };
        await addDoc(collection(db, 'requests'), payload);
        modal.style.display = 'none';
        $('#addItemQty').value = '';
    });
}

// --- Modal: Catalog Item (Add/Edit) ---
export function openCatalogModal(itemId = null) {
    currentCatalogItemId = itemId; 
    currentCatalogItem = itemId ? state.catalog.find(i => i.id === itemId) : { isActive: true };
    const item = currentCatalogItem;
    
    $('#catalogModalTitle').textContent = itemId ? 'Edit Catalog Item' : 'Add New Catalog Item';
    $('#editItemName').value = item.itemName || ''; 
    $('#editItemRef').value = item.itemRef || '';
    $('#editUnit').value = item.unit || ''; 
    $('#editPackSize').value = item.packSize || 1;
    $('#editParLevel').value = item.parLevel || 0;
    
    const activeBtn = $('#toggleActiveBtn');
    if (item.isActive === false) {
        activeBtn.textContent = 'Re-Activate Item';
        activeBtn.classList.add('ok');
        activeBtn.classList.remove('danger');
    } else {
        activeBtn.textContent = 'Inactivate Item';
        activeBtn.classList.add('danger');
        activeBtn.classList.remove('ok');
    }
    activeBtn.style.display = itemId ? 'inline-block' : 'none';
    
    const catSelect = $('#editCategorySelect');
    catSelect.innerHTML = '<option value="">-- Select Category --</option>' + state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    catSelect.value = item.category || '';
    
    const altNameArray = Array.isArray(item.itemNameAlt) ? item.itemNameAlt : (item.itemNameAlt ? [item.itemNameAlt] : []);
    setupListInput($('#altNameList'), $('#newAltName'), $('#addNewAltNameBtn'), altNameArray);
    
    const barcodeArray = Array.isArray(item.barcode) ? item.barcode : (item.barcode ? [item.barcode] : []);
    setupListInput($('#barcodeList'), $('#newBarcode'), $('#addNewBarcodeBtn'), barcodeArray);
    
    const pricingContainer = $('#catalogItemPricingTable');
    const addPriceBtn = $('#addPriceInModalBtn');
    if (itemId) {
        addPriceBtn.style.display = 'inline-block';
        addPriceBtn.onclick = () => {
            if (hasUnsavedCatalogChanges()) return alert("You have unsaved changes. Please save the item first.");
            openPricingModal(null, itemId);
        };

        const prices = (state.pricingMap.get(itemId) || []).map(p => ({...p, vendorName: state.vendorMap.get(p.vendorId) || 'Unknown'}));
        if (prices.length > 0) {
            const rows = prices.map(p => {
                const isPreferred = p.vendorId === item.preferredVendorId;
                return `
                <tr style="${isPreferred ? 'background-color: #dbeafe;' : ''}">
                    <td>${escapeHtml(p.vendorName)}</td>
                    <td>${escapeHtml(p.vendorItemNo)}</td>
                    <td>$${(p.unitPrice||0).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-small" data-edit-price-id-modal="${p.id}">Edit</button>
                        <button class="btn btn-small ${isPreferred ? 'primary' : ''}" 
                                data-set-preferred-vendor="${p.vendorId}" 
                                data-item-id="${itemId}" 
                                ${isPreferred ? 'disabled' : ''}>
                            ${isPreferred ? 'Preferred' : 'Set'}
                        </button>
                    </td>
                </tr>
            `}).join('');
            pricingContainer.innerHTML = `<table style="font-size:0.9rem; width: 100%;"><thead><tr><th>Vendor</th><th>Vendor Order #</th><th>Price</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
            
            pricingContainer.querySelectorAll('[data-edit-price-id-modal]').forEach(btn => {
                btn.onclick = () => {
                    if (hasUnsavedCatalogChanges()) return alert("You have unsaved changes. Please save the item first.");
                    openPricingModal(btn.dataset.editPriceIdModal);
                };
            });
            pricingContainer.querySelectorAll('[data-set-preferred-vendor]').forEach(btn => {
                btn.onclick = async () => {
                    if (hasUnsavedCatalogChanges()) return alert("You have unsaved changes. Please save the item first.");
                    const vendorId = btn.dataset.setPreferredVendor;
                    const catId = btn.dataset.itemId;
                    await updateDoc(doc(db, "catalog", catId), { preferredVendorId: vendorId, updatedAt: serverTimestamp() });
                    await initializeStaticData(); 
                    openCatalogModal(catId); 
                };
            });
        } else {
            pricingContainer.innerHTML = '<p class="muted">No vendor pricing recorded.</p>';
        }
    } else {
        pricingContainer.innerHTML = '<p class="muted">Save item first to add pricing.</p>';
        addPriceBtn.style.display = 'none';
    }
    
    applyPermissions(state.userRole);
    $('#catalogModal').style.display = 'flex';
}

export function closeCatalogModal() {
    if (isScannerActive) Quagga.stop(); 
    isScannerActive = false; 
    $('#barcodeScannerViewport').style.display = 'none'; 
    $('#catalogModal').style.display = 'none'; 
    currentCatalogItemId = null;
    currentCatalogItem = null;
}

export function setupCatalogModal() {
    $('#scanNewBarcodeBtn').addEventListener('click', () => startScanner($('#newBarcode'), $('#barcodeScannerViewport')));
    
    $('#saveCatalogEdit').addEventListener('click', async () => {
        const data = { 
            itemName: $('#editItemName').value, 
            itemRef: $('#editItemRef').value, 
            unit: $('#editUnit').value, 
            packSize: Number($('#editPackSize').value) || 1, 
            parLevel: Number($('#editParLevel').value) || 0,
            category: $('#editCategorySelect').value,
            itemNameAlt: getListItems($('#altNameList')), 
            barcode: getListItems($('#barcodeList')), 
            isActive: currentCatalogItem.isActive,
            updatedAt: serverTimestamp() 
        };
        
        if (currentCatalogItemId) { 
            await updateDoc(doc(db, "catalog", currentCatalogItemId), data); 
        } else { 
            data.createdAt = serverTimestamp();
            data.isActive = true;
            await addDoc(collection(db, "catalog"), data); 
        }
        
        closeCatalogModal();
        await initializeStaticData();
    });
    
    $('#toggleActiveBtn').addEventListener('click', async () => {
        if (currentCatalogItemId && currentCatalogItem) {
            const newState = !currentCatalogItem.isActive;
            const action = newState ? 'activate' : 'inactivate';
            if (confirm(`Are you sure you want to ${action} this item?`)) {
                await updateDoc(doc(db, "catalog", currentCatalogItemId), { isActive: newState });
                closeCatalogModal();
                await initializeStaticData();
            }
        }
    });
}

// --- Modal: Pricing (Add/Edit) ---
export function openPricingModal(priceId = null, catalogId = null) {
    currentPriceId = priceId; 
    const price = priceId ? state.pricingAll.find(p => p.id === priceId) : {};
    currentCatalogIdForPricing = catalogId || price.catalogId;
    
    const itemSelect = $('#priceItemSelect');
    const vendorSelect = $('#priceVendorSelect');
    
    itemSelect.innerHTML = state.catalog.map(i => `<option value="${i.id}">${escapeHtml(i.itemName)}</option>`).join('');
    vendorSelect.innerHTML = state.vendors
        .map(v => `<option value="${v.id}">${escapeHtml(v.name)}</option>`)
        .join('');
    
    if (priceId) {
        itemSelect.value = price.catalogId;
        itemSelect.disabled = false;
        vendorSelect.value = price.vendorId;
        $('#priceSku').value = price.vendorItemNo || ''; 
        $('#priceUnitPrice').value = price.unitPrice || '';
        $('#priceVendorStatus').value = price.vendorStatus || 'In Stock';
        $('#pricingModalTitle').textContent = 'Edit Vendor Price';
    } else if (catalogId) {
        itemSelect.value = catalogId;
        itemSelect.disabled = true;
        vendorSelect.value = '';
        $('#priceSku').value = ''; 
        $('#priceUnitPrice').value = '';
        $('#priceVendorStatus').value = 'In Stock';
        $('#pricingModalTitle').textContent = 'Add New Price';
    }
    
    $('#pricingModal').style.display = 'flex';
}

export function setupPricingModal() {
    $('#savePricingEdit').addEventListener('click', async () => {
        const itemSelect = $('#priceItemSelect');
        const vendorId = $('#priceVendorSelect').value;
        const catalogId = itemSelect.value;
        
        const data = { 
            catalogId: catalogId, 
            vendorId: vendorId, 
            vendorItemNo: $('#priceSku').value, 
            unitPrice: Number($('#priceUnitPrice').value) || 0,
            vendorStatus: $('#priceVendorStatus').value
        };
        
        if (!data.catalogId || !data.vendorId) {
            return alert("Please select an item and vendor.");
        }

        try {
            if (currentPriceId) { 
                await updateDoc(doc(db, "vendorPricing", currentPriceId), data); 
            } else { 
                await addDoc(collection(db, "vendorPricing"), data); 
            }
            
            $('#pricingModal').style.display = 'none';
            itemSelect.disabled = false;
            
            if ($('#catalogModal').style.display === 'flex' && currentCatalogIdForPricing) {
                 await initializeStaticData();
                 openCatalogModal(currentCatalogIdForPricing);
            }

        } catch (e) {
            console.error("Error saving price:", e);
            alert("Error saving. See console.");
        }
    });
}

// --- Modal: Change Vendor Override ---
export function openChangeVendorModal(requestId) {
    currentRequestIdToChange = requestId;
    const request = state.requests.find(r => r.id === requestId);
    if (!request) return;
    
    const catItem = state.catalogMap.get(request.catalogId);
    $('#changeVendorItemName').textContent = catItem ? catItem.itemName : 'This item';

    const vendorSelect = $('#changeVendorSelect');
    vendorSelect.innerHTML = '<option value="">-- Select New Vendor --</option>' + 
                             state.vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    
    $('#changeVendorModal').style.display = 'flex';
}

export function setupChangeVendorModal() {
    $('#saveVendorOverrideBtn').addEventListener('click', async () => {
        const newVendorId = $('#changeVendorSelect').value;
        if (!newVendorId || !currentRequestIdToChange) {
            return alert("Please select a vendor.");
        }
        
        try {
            await updateDoc(doc(db, 'requests', currentRequestIdToChange), {
                overrideVendorId: newVendorId,
                updatedAt: serverTimestamp()
            });
            $('#changeVendorModal').style.display = 'none';
            currentRequestIdToChange = null;
        } catch (e) {
            console.error("Failed to override vendor:", e);
            alert("Error saving override.");
        }
    });
}

// --- Modal: Vendor (Add/Edit) ---
export function openVendorModal(vendorId = null) {
    currentVendorId = vendorId;
    const modal = $('#vendorModal');
    const v = vendorId ? state.vendors.find(v => v.id === vendorId) : {};
    
    $('#vendorModalTitle').textContent = vendorId ? 'Edit Vendor' : 'Add New Vendor';
    $('#vendorName').value = v.name || '';
    $('#vendorAccountNumber').value = v.accountNumber || '';
    $('#vendorOrderUrl').value = v.orderUrl || '';
    $('#vendorWebUrl').value = v.weburl || '';
    $('#vendorPhone').value = v.phone || '';
    $('#vendorContactName').value = v.contactName || '';
    $('#vendorContactPhone').value = v.contactPhone || '';
    $('#vendorContactEmail').value = v.contactEmail || '';
    $('#vendorEmail').value = v.email || '';
    $('#vendorAddress').value = v.address || '';
    $('#vendorNotes').value = v.notes || '';
    
    modal.style.display = 'flex';
}

export function setupVendorModal() {
    $('#saveVendorBtn').addEventListener('click', async () => {
        const data = {
            name: $('#vendorName').value.trim(),
            accountNumber: $('#vendorAccountNumber').value.trim(),
            orderUrl: $('#vendorOrderUrl').value.trim(),
            weburl: $('#vendorWebUrl').value.trim(),
            phone: $('#vendorPhone').value.trim(),
            contactName: $('#vendorContactName').value.trim(),
            contactPhone: $('#vendorContactPhone').value.trim(),
            contactEmail: $('#vendorContactEmail').value.trim(),
            email: $('#vendorEmail').value.trim(),
            address: $('#vendorAddress').value.trim(),
            notes: $('#vendorNotes').value.trim(),
            updatedAt: serverTimestamp()
        };

        if (!data.name) return alert('Vendor Name is required.');

        try {
            if (currentVendorId) {
                await updateDoc(doc(db, 'vendors', currentVendorId), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'vendors'), data);
            }
            $('#vendorModal').style.display = 'none';
            await initializeStaticData();
        } catch (e) {
            console.error('Error saving vendor:', e);
            alert('Could not save vendor.');
        }
    });
}

// --- Modal: Management Generic Edit ---
export function openMgmtEditModal(collection, id, currentName) {
    currentMgmtEdit = { collection, id };
    let title = "Edit Item";

    if (collection === 'units') title = "Edit Unit";
    else if (collection === 'compartments') title = "Edit Compartment";
    else if (collection === 'categories') title = "Edit Category";

    $('#mgmtEditModalTitle').textContent = title;
    $('#mgmtEditName').value = currentName;
    $('#mgmtEditModal').style.display = 'flex';
}

export function setupMgmtEditModal() {
    $('#saveMgmtEditBtn').addEventListener('click', async () => {
        const { collection, id } = currentMgmtEdit;
        const newName = $('#mgmtEditName').value.trim();

        if (!collection || !id || !newName) {
            alert("Error: Missing data or name is empty.");
            return;
        }

        try {
            await updateDoc(doc(db, collection, id), { name: newName });
            $('#mgmtEditModal').style.display = 'none';
            await initializeStaticData();
        } catch (e) {
            console.error("Error updating document:", e);
            alert("Could not save changes.");
        }
    });
}

// --- Modal: Print Order ---
function generateVendorOrderHtml(vendorName, requests) {
     const rows = requests.map(r => {
        const catItem = state.catalogMap.get(r.catalogId);
        const vendorInfo = findBestVendor(r.catalogId, catItem.preferredVendorId, r.overrideVendorId);
        return `
            <tr>
                <td>${escapeHtml(catItem.itemName)}</td>
                <td>${escapeHtml(catItem.itemRef || 'N/A')}</td>
                <td>${escapeHtml(vendorInfo.vendorItemNo || 'N/A')}</td>
                <td>${escapeHtml(r.qty)} ${escapeHtml(catItem.unit || 'Each')}</td>
            </tr>
        `;
    }).join('');

    return `
        <h3>Order for: ${escapeHtml(vendorName)}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; margin-bottom: 2rem;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th>Item Name</th>
                    <th>Ref #</th>
                    <th>Vendor Item #</th>
                    <th>Quantity Needed</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>`;
}

export function showPrintModal(vendorName, selectedRequests) {
    const modal = $('#printOrderModal');
    $('#printOrderTitle').textContent = `EMS Order - ${getFormattedDate()}`;
    
    const headerHtml = `
        <p><strong>Vendor:</strong> ${escapeHtml(vendorName)}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Requested By:</strong> ${escapeHtml(state.user.email)}</p>
    `;
    
    const tableHtml = generateVendorOrderHtml(vendorName, selectedRequests);
    $('#printOrderBody').innerHTML = headerHtml + tableHtml;
    modal.style.display = 'flex';
}

export function showMasterOrderModal(groupedRequests) {
    const modal = $('#printOrderModal');
    $('#printOrderTitle').textContent = `EMS Order - ${getFormattedDate()}`;
    
    let finalHtml = `
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Requested By:</strong> ${escapeHtml(state.user.email)}</p>
    `;

    groupedRequests.forEach((requests, vendorId) => {
        const vendorName = state.vendorMap.get(vendorId) || 'Unassigned';
        finalHtml += generateVendorOrderHtml(vendorName, requests);
    });

    $('#printOrderBody').innerHTML = finalHtml;
    modal.style.display = 'flex';
}

function handlePrint() {
    const modal = $('#printOrderModal');
    const title = $('#printOrderTitle').textContent;
    const header = $('#printOrderHeader').innerHTML;
    const body = $('#printOrderBody').innerHTML;

    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write('<html><head><title>Print Order</title>');
    printWindow.document.write(`
        <style>
            body { font-family: system-ui, -apple-system, sans-serif; }
            table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 0; }
            th, td { padding: 4px 6px; border: 1px solid #ccc; text-align: left; }
            th { background-color: #eee; }
            h2, h3 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
            .print-header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; text-align: center; }
            .print-header img { max-width: 150px; }
            .print-header .address { font-size: 10pt; line-height: 1.4; }
            @page { size: auto; margin: 0.5in; }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<div class="print-header">${header}</div>`);
    printWindow.document.write(`<h2 style="text-align: center;">${escapeHtml(title)}</h2>`);
    printWindow.document.write(body);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

export function setupPrintModal() {
    $('#printOrderBtn').addEventListener('click', handlePrint);
}
export function openExportModal() {
    $('#exportModal').style.display = 'flex';
}

export function setupExportModal() {
    $('#confirmExportBtn').addEventListener('click', () => {
        const selectedFields = Array.from(document.querySelectorAll('.export-field:checked')).map(cb => cb.value);
        const pricingOption = document.querySelector('input[name="priceOption"]:checked').value;
        
        if (selectedFields.length === 0) {
            alert("Please select at least one field to export.");
            return;
        }

        const { data, columns } = buildExportData(selectedFields, pricingOption);
        
        if (data.length === 0) {
            alert("No active catalog items to export.");
            return;
        }
        
        const csvString = exportToCsv(data, columns);
        downloadCsv(csvString, 'ems_catalog_export.csv');
        $('#exportModal').style.display = 'none';
    });
}

function buildExportData(selectedFields, pricingOption) {
    const data = [];
    let columns = [...selectedFields]; // Start with base catalog fields
    
    // Add price columns if needed
    if (pricingOption === 'lowest' || pricingOption === 'preferred') {
        columns.push('vendorName', 'vendorItemNo', 'unitPrice');
    } else if (pricingOption === 'all') {
        columns.push('vendorName', 'vendorItemNo', 'unitPrice', 'vendorStatus');
    }

    const itemsToExport = state.catalog.filter(item => item.isActive !== false);

    for (const item of itemsToExport) {
        // Build the base row with selected catalog fields
        const baseRow = {};
        for (const field of selectedFields) {
            if (field === 'categoryName') {
                baseRow[field] = state.categoryMap.get(item.category) || item.category || '';
            } else if (field === 'barcode') {
                baseRow[field] = Array.isArray(item.barcode) ? item.barcode.join('; ') : (item.barcode || '');
            } else {
                baseRow[field] = item[field] || '';
            }
        }
        
        const prices = (state.pricingMap.get(item.id) || [])
            .map(p => ({
                ...p, 
                vendorName: state.vendorMap.get(p.vendorId) || 'N/A'
            }))
            .sort((a,b) => (a.unitPrice || Infinity) - (b.unitPrice || Infinity));

        // Add pricing data based on the selected option
        if (pricingOption === 'none') {
            data.push(baseRow);
        } 
        else if (pricingOption === 'lowest') {
            const lowestPrice = prices[0];
            if (lowestPrice) {
                data.push({
                    ...baseRow,
                    vendorName: lowestPrice.vendorName,
                    vendorItemNo: lowestPrice.vendorItemNo || '',
                    unitPrice: lowestPrice.unitPrice || 0
                });
            } else {
                data.push(baseRow); // Add item even if no price
            }
        } 
        else if (pricingOption === 'preferred') {
            const preferredPrice = prices.find(p => p.vendorId === item.preferredVendorId);
            if (preferredPrice) {
                data.push({
                    ...baseRow,
                    vendorName: preferredPrice.vendorName,
                    vendorItemNo: preferredPrice.vendorItemNo || '',
                    unitPrice: preferredPrice.unitPrice || 0
                });
            } else {
                data.push(baseRow); // Add item even if no preferred price
            }
        }
        else if (pricingOption === 'all') {
            if (prices.length === 0) {
                data.push(baseRow); // Add item once even if no prices
            } else {
                // Add one row for *each* price
                for (const price of prices) {
                    data.push({
                        ...baseRow,
                        vendorName: price.vendorName,
                        vendorItemNo: price.vendorItemNo || '',
                        unitPrice: price.unitPrice || 0,
                        vendorStatus: price.vendorStatus || 'In Stock'
                    });
                }
            }
        }
    }
    
    return { data, columns };
}
// --- Close Modal Global ---
export function setupModalCloseButtons() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.currentTarget.dataset.closeModal;
            if(modalId === 'catalogModal') closeCatalogModal();
            else if (modalId) $(`#${modalId}`).style.display = 'none';
        });
    });
}