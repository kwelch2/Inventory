// modules/app.js
import { 
  doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc, deleteField
} from "./firebase.js"; // <--- CHANGED
import { state } from "./state.js";
import { db } from "./firebase.js"; // <--- db is still imported from here
import { onUserHandler, login, logout, applyPermissions } from "./auth.js";
import { $, escapeHtml } from "./helpers/utils.js";
import { initializeStaticData, setupRealtimeListeners, updateRequestStatus, findBestVendor } from "./firestoreApi.js";
import { renderOrders } from "./ui/orders.js";
import { renderCatalog, setupCatalogPanel, populateCategoryFilter } from "./ui/catalog.js";
import { mountTabs, mountManagementTabs } from "./ui/tabs.js";
import { 
    setupAddItemToOrderModal, setupCatalogModal, setupPricingModal, 
    setupChangeVendorModal, setupVendorModal, setupMgmtEditModal,
    setupPrintModal, setupModalCloseButtons, showPrintModal, showMasterOrderModal,
    openVendorModal, openMgmtEditModal, openChangeVendorModal, 
    openExportModal, setupExportModal
} from "./ui/modals.js";

let appInitialized = false;

// --- Main App Initialization ---
async function boot() {
    if (appInitialized) return;
    appInitialized = true;

    mountTabs();
    mountManagementTabs();
    
    // Setup all modal triggers and save buttons
    setupAddItemToOrderModal();
    setupCatalogModal();
    setupPricingModal();
    setupChangeVendorModal();
    setupVendorModal();
    setupMgmtEditModal();
    setupPrintModal();
    setupModalCloseButtons();
    setupExportModal();

    // Setup panel-specific listeners
    setupCatalogPanel();
    setupOrdersPanelListeners();
    setupManagementPanelActions();
    
    // Setup refresh buttons
    ['refreshCatalog', 'refreshUnits', 'refreshCompartments', 'refreshCategories', 'refreshVendors'].forEach(id => {
        const btn = $(`#${id}`); 
        if (btn) btn.addEventListener('click', initializeStaticData);
    });
    
    await initializeStaticData();
    setupRealtimeListeners();
    applyPermissions(state.userRole); // Apply permissions once data is loaded
}

// --- Event Listeners ---
function setupOrdersPanelListeners() {
    // Listener for Order filtering
    const ordersPanelRow = document.querySelector('#panel-orders .row');
    if (ordersPanelRow) {
        ordersPanelRow.addEventListener('click', e => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderOrders();
            }
            if (e.target.classList.contains('view-btn')) {
                document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                state.orderViewMode = e.target.dataset.view;
                renderOrders();
            }
        });
    }

    // *** FIX: Added '#' ***
    const historyToggle = $('#showHistoryToggle');
    if (historyToggle) {
        historyToggle.addEventListener('change', renderOrders);
    }
    
    // Generate Order from "View by Item"
    // *** FIX: Added '#' ***
    const genItemOrderBtn = $('#generateItemOrderBtn');
    if (genItemOrderBtn) {
        genItemOrderBtn.addEventListener('click', () => {
            const selectedCheckboxes = document.querySelectorAll('.item-order-checkbox:checked');
            if (selectedCheckboxes.length === 0) {
                alert("Please select items to include in the order.");
                return;
            }
            const selectedRequestIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.requestId);
            const selectedRequests = state.requests
                .filter(r => selectedRequestIds.includes(r.id))
                .map(r => {
                    const catItem = state.catalogMap.get(r.catalogId);
                    const vendorInfo = findBestVendor(r.catalogId, catItem?.preferredVendorId, r.overrideVendorId);
                    return { ...r, catItem, vendorInfo };
                });

            const groupedRequests = new Map();
            for (const r of selectedRequests) {
                const vendorId = r.vendorInfo.vendorId;
                if (!groupedRequests.has(vendorId)) groupedRequests.set(vendorId, []);
                groupedRequests.get(vendorId).push(r);
            }
            showMasterOrderModal(groupedRequests);
        });
    }


    // Event delegation for Orders panel CLICK actions
    // *** FIX: Added '#' ***
    const ordersContainer = $('#ordersGroupContainer');
    if (ordersContainer) {
        ordersContainer.addEventListener('click', async e => {
            const target = e.target;
            
            if (target.classList.contains('vendor-select-all') || target.classList.contains('item-select-all')) {
                const groupContainer = target.closest('.vendor-group, .vendor-group-table');
                const isChecked = target.checked;
                const checkboxClass = state.orderViewMode === 'vendor' ? '.order-item-checkbox' : '.item-order-checkbox';
                groupContainer.querySelectorAll(checkboxClass).forEach(cb => cb.checked = isChecked);
                return;
            }

            if (target.classList.contains('generate-order-btn')) {
                const vendorName = target.dataset.vendorName;
                const groupContainer = target.closest('.vendor-group');
                const selectedCheckboxes = groupContainer.querySelectorAll('.order-item-checkbox:checked');
                if (selectedCheckboxes.length === 0) return alert("Please select at least one item to order.");
                const selectedRequestIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.requestId);
                const selectedRequests = state.requests.filter(r => selectedRequestIds.includes(r.id));
                showPrintModal(vendorName, selectedRequests);
                return;
            }
            
            const tr = target.closest('tr[data-request-id]');
            if (!tr) return; 
            
            const requestId = tr.dataset.requestId;

            if (target.dataset.toggleDetails !== undefined) {
                const detailsRow = tr.nextElementSibling;
                if (detailsRow && detailsRow.dataset.detailsFor === requestId) {
                    detailsRow.classList.toggle('visible');
                }
                return;
            }

            if (target.dataset.status) {
                await updateRequestStatus(requestId, target.dataset.status);
                return;
            }
            
            if (target.dataset.changeVendorId) {
                openChangeVendorModal(requestId);
                return;
            }
        });

        // Listeners for Qty changes (blur and Enter)
        ordersContainer.addEventListener('blur', e => {
            if (e.target.classList.contains('quick-qty-edit')) {
                handleQuickQtyUpdate(e.target);
            }
        }, true);

        ordersContainer.addEventListener('keydown', e => {
            if (e.key === 'Enter' && e.target.classList.contains('quick-qty-edit')) {
                handleQuickQtyUpdate(e.target);
                e.target.blur();
            }
        });
    }
}

async function handleQuickQtyUpdate(target) {
    const requestId = target.dataset.requestId;
    const newQty = target.value.trim();
    const originalQty = target.dataset.originalValue;

    if (!newQty) {
        target.classList.add('error');
        alert("Quantity cannot be empty.");
        target.value = originalQty;
        setTimeout(() => target.classList.remove('error'), 1000);
        return;
    }
    if (newQty === originalQty) return; // No change

    try {
        await updateDoc(doc(db, 'requests', requestId), {
            qty: newQty,
            updatedAt: serverTimestamp()
        });
        target.dataset.originalValue = newQty;
        target.classList.add('success');
        setTimeout(() => target.classList.remove('success'), 1500);
    } catch (e) {
        console.error("Failed to update quantity:", e);
        target.classList.add('error');
        alert("Error saving quantity.");
        target.value = originalQty;
        setTimeout(() => target.classList.remove('error'), 1000);
    }
}

function setupManagementPanelActions() {
    // *** FIX: Added '#' ***
    const mgmtPanel = $('#panel-management');
    if (mgmtPanel) {
        mgmtPanel.addEventListener('click', async e => {
            const target = e.target;
            
            // --- Add Actions ---
            if (target.id === 'addUnitBtn') {
                // *** FIX: Added '#' ***
                const nameInput = $('#newUnitName');
                const name = nameInput.value.trim();
                if (name) { 
                    await addDoc(collection(db, 'units'), { name }); 
                    nameInput.value = ''; 
                    await initializeStaticData(); 
                }
            }
            else if (target.id === 'addCompBtn') {
                // *** FIX: Added '#' ***
                const nameInput = $('#newCompName');
                const name = nameInput.value.trim();
                if (name) { 
                    await addDoc(collection(db, 'compartments'), { name }); 
                    nameInput.value = ''; 
                    await initializeStaticData(); 
                }
            }
            else if (target.id === 'addCategoryBtn') {
                // *** FIX: Added '#' ***
                const nameInput = $('#newCategoryName');
                const name = nameInput.value.trim();
                if (name) { 
                    await addDoc(collection(db, 'categories'), { name }); 
                    nameInput.value = ''; 
                    await initializeStaticData(); 
                }
            }
            else if (target.id === 'addVendorBtn') {
                openVendorModal();
            }

            // --- Delete Actions ---
            else if (target.dataset.deleteUnitId && confirm('Are you sure you want to delete this unit?')) {
                await deleteDoc(doc(db, 'units', target.dataset.deleteUnitId)); 
                await initializeStaticData();
            }
            else if (target.dataset.deleteCompId && confirm('Are you sure you want to delete this compartment?')) {
                await deleteDoc(doc(db, 'compartments', target.dataset.deleteCompId)); 
                await initializeStaticData();
            }
            else if (target.dataset.deleteCategoryId && confirm('Are you sure you want to delete this category?')) {
                await deleteDoc(doc(db, 'categories', target.dataset.deleteCategoryId));
                await initializeStaticData();
            }
            else if (target.dataset.deleteVendorId && confirm('Are you sure you want to delete this vendor?')) {
                await deleteDoc(doc(db, 'vendors', target.dataset.deleteVendorId));
                await initializeStaticData();
            }

            // --- Edit Actions ---
            else if (target.dataset.editVendorId) {
                openVendorModal(target.dataset.editVendorId);
            }
            else if (target.dataset.editCollection && target.dataset.editId) {
                openMgmtEditModal(target.dataset.editCollection, target.dataset.editId, target.dataset.editName);
            }
        });
    }
}

// --- App Start ---
// ***** THIS IS THE FIX *****
// Wait for the entire HTML document to be loaded before running any script
document.addEventListener("DOMContentLoaded", () => {
    
    const loadingContainer = $("#loading-container");
    if (loadingContainer) {
        loadingContainer.style.display = "block";
    }

    // Listen for auth state changes
    onUserHandler((isLoggedIn) => {
        if (isLoggedIn && !appInitialized) {
            boot();
        } else if (!isLoggedIn) {
            appInitialized = false; // Reset app if user logs out
        }
    });

    // Wire up login/logout buttons
    const loginBtn = $("#googleLoginBtn");
    if (loginBtn) {
        loginBtn.addEventListener("click", login);
    }

    const logoutBtn = $("#logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
});