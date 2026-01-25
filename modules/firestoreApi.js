// modules/firestoreApi.js
import { 
  collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, 
  writeBatch, serverTimestamp, query, where, orderBy, onSnapshot, deleteField
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { state } from "./state.js";
import { renderCatalog, populateCategoryFilter } from "./ui/catalog.js";
import { renderOrders } from "./ui/orders.js";
import { renderUnits, renderCompartments, renderCategories, renderVendors } from "./ui/management.js";

/**
 * Initializes static/reference data from Firestore.
 * This data is loaded once on login and refreshed manually.
 */
export async function initializeStaticData() {
    try {
        const [catSnap, venSnap, unitSnap, compSnap, catMgmtSnap] = await Promise.all([
            getDocs(collection(db, "catalog")),
            getDocs(collection(db, "vendors")),
            getDocs(collection(db, "units")),
            getDocs(collection(db, "compartments")),
            getDocs(collection(db, "categories"))
        ]);
        
        state.catalog = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        state.vendors = venSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name));
        state.units = unitSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name));
        state.compartments = compSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name));
        state.categories = catMgmtSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name));
        
        state.catalogMap = new Map(state.catalog.map(c => [c.id, c]));
        state.vendorMap = new Map(state.vendors.map(v => [v.id, v.name]));
        state.categoryMap = new Map(state.categories.map(c => [c.id, c.name]));
        
        // Re-render components that depend on this static data
        renderCatalog();
        renderUnits();
        renderCompartments();
        renderCategories();
        renderVendors();
        populateCategoryFilter();
    } catch(e) {
        console.error("Static Data Load Failed:", e);
        alert("Static Data Load Failed: " + e.message);
    }
}

/**
 * Sets up real-time listeners for dynamic data (requests and pricing).
 * Stores unsubscribe functions in state for proper cleanup on logout.
 */
export function setupRealtimeListeners() {
    // Clear any existing listeners first
    if (state.unsubscribers && state.unsubscribers.length > 0) {
        state.unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        state.unsubscribers = [];
    }

    // Setup requests listener
    const unsubscribeRequests = onSnapshot(
        collection(db, "requests"), 
        (reqSnap) => {
            state.requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderOrders();
        },
        (error) => {
            console.error("Requests listener error:", error);
        }
    );

    // Setup vendor pricing listener
    const unsubscribePricing = onSnapshot(
        collection(db, "vendorPricing"), 
        (priceSnap) => {
            state.pricingAll = priceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            state.pricingMap.clear();
            state.pricingAll.forEach(p => {
                if (!state.pricingMap.has(p.catalogId)) state.pricingMap.set(p.catalogId, []);
                state.pricingMap.get(p.catalogId).push(p);
            });
            renderOrders(); 
            renderCatalog();
        },
        (error) => {
            console.error("Vendor pricing listener error:", error);
        }
    );

    // Store unsubscribe functions for cleanup
    state.unsubscribers = [unsubscribeRequests, unsubscribePricing];
}

/**
 * Finds the best vendor for a catalog item based on pricing and availability.
 * @param {string} catalogId - The catalog item ID
 * @param {string} preferredVendorId - Optional preferred vendor ID
 * @param {string} overrideVendorId - Optional manual override vendor ID
 * @returns {Object} Vendor information with pricing
 */
export function findBestVendor(catalogId, preferredVendorId, overrideVendorId) {
    // Create a vendor lookup map for efficient access
    const vendorLookup = new Map(state.vendors.map(v => [v.id, v]));

    const prices = (state.pricingMap.get(catalogId) || [])
        .map(p => {
            const vendorObj = vendorLookup.get(p.vendorId);
            const fee = vendorObj?.serviceFee || 0;
            return {
                ...p, 
                vendorName: vendorObj?.name || 'Unknown Vendor',
                effectivePrice: (p.unitPrice || 0) * (1 + (fee / 100)), // Calculate once
                hasFee: fee > 0
            };
        })
        .sort((a,b) => a.effectivePrice - b.effectivePrice); // Sort by EFFECTIVE price

    // 1. Check for manual override
    if (overrideVendorId) {
        const overridePrice = prices.find(p => p.vendorId === overrideVendorId);
        if (overridePrice) {
             return {
                vendorId: overridePrice.vendorId,
                vendorName: overridePrice.vendorName,
                vendorItemNo: overridePrice.vendorItemNo || 'N/A',
                unitPrice: overridePrice.effectivePrice, // Return effective price
                status: 'Manual Override'
            };
        }
        return {
            vendorId: overrideVendorId,
            vendorName: state.vendorMap.get(overrideVendorId) || 'Unknown Vendor',
            vendorItemNo: 'N/A',
            unitPrice: 0,
            status: 'Manual Override'
        };
    }
    
    const preferredPrice = preferredVendorId ? prices.find(p => p.vendorId === preferredVendorId) : null;
    
    // 2. Try Preferred Vendor if in stock
    if (preferredPrice && (preferredPrice.vendorStatus === 'In Stock' || !preferredPrice.vendorStatus)) {
        return {
            vendorId: preferredPrice.vendorId,
            vendorName: preferredPrice.vendorName,
            vendorItemNo: preferredPrice.vendorItemNo || 'N/A',
            unitPrice: preferredPrice.effectivePrice, // Use Effective
            status: 'Preferred'
        };
    }
    
    // 3. Find cheapest vendor that is "In Stock"
    // (Prices are already sorted by effective price)
    const cheapestInStock = prices.find(p => p.vendorStatus === 'In Stock' || !p.vendorStatus);
    if (cheapestInStock) {
        return {
            vendorId: cheapestInStock.vendorId,
            vendorName: cheapestInStock.vendorName,
            vendorItemNo: cheapestInStock.vendorItemNo || 'N/A',
            unitPrice: cheapestInStock.effectivePrice, // Use Effective
            status: 'Cheapest'
        };
    }

    // 4. Fallback: Preferred (Backordered)
    if (preferredPrice) {
        return {
            vendorId: preferredPrice.vendorId,
            vendorName: preferredPrice.vendorName,
            vendorItemNo: preferredPrice.vendorItemNo || 'N/A',
            unitPrice: preferredPrice.effectivePrice, // Use Effective
            status: `Preferred (${preferredPrice.vendorStatus || 'N/A'})`
        };
    }
    
    // 5. Fallback: Cheapest (Backordered)
    const cheapestOverall = prices[0];
    if (cheapestOverall) {
        return {
            vendorId: cheapestOverall.vendorId,
            vendorName: cheapestOverall.vendorName,
            vendorItemNo: cheapestOverall.vendorItemNo || 'N/A',
            unitPrice: cheapestOverall.effectivePrice, // Use Effective
            status: `Cheapest (${cheapestOverall.vendorStatus || 'N/A'})`
        };
    }

    return { vendorId: 'unassigned', vendorName: 'Unassigned / No Pricing', vendorItemNo: 'N/A', unitPrice: 0, status: 'No Pricing' };
}

/**
 * Updates the status of a supply request.
 * @param {string} requestId - The request document ID
 * @param {string} newStatus - The new status value
 */
export async function updateRequestStatus(requestId, newStatus) {
    if (!requestId || !newStatus) return;
    
    const updatePayload = { status: newStatus, updatedAt: serverTimestamp() };
    
    if (newStatus === 'Received' || newStatus === 'Completed') {
        updatePayload.receivedAt = serverTimestamp();
        updatePayload.overrideVendorId = deleteField(); // Clear override when received
    } 
    else if (newStatus === 'Open') {
         updatePayload.overrideVendorId = deleteField(); // Clear override if sent back to Open
    }
    else if (newStatus === 'Ordered') {
        updatePayload.lastOrdered = serverTimestamp();
    }
    
    try {
        await updateDoc(doc(db, 'requests', requestId), updatePayload);
    } catch(e) {
        console.error("Status update failed:", e);
        alert("Could not update status.");
    }
}