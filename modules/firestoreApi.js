// modules/firestoreApi.js
import { 
  collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, 
  writeBatch, serverTimestamp, query, where, orderBy, onSnapshot, deleteField
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { state } from "./state.js";
import { renderCatalog } from "./ui/catalog.js";
import { renderOrders } from "./ui/orders.js";
import { renderUnits, renderCompartments, renderCategories, renderVendors } from "./ui/management.js";

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
    } catch(e) {
        console.error("Static Data Load Failed:", e);
        alert("Static Data Load Failed: " + e.message);
    }
}

export function setupRealtimeListeners() {
    onSnapshot(collection(db, "requests"), (reqSnap) => {
        state.requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrders();
    });

    onSnapshot(collection(db, "vendorPricing"), (priceSnap) => {
        state.pricingAll = priceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        state.pricingMap.clear();
        state.pricingAll.forEach(p => {
            if (!state.pricingMap.has(p.catalogId)) state.pricingMap.set(p.catalogId, []);
            state.pricingMap.get(p.catalogId).push(p);
        });
        renderOrders(); 
        renderCatalog();
    });
}

export function findBestVendor(catalogId, preferredVendorId, overrideVendorId) {
    const prices = (state.pricingMap.get(catalogId) || [])
        .map(p => ({...p, vendorName: state.vendorMap.get(p.vendorId) || 'Unknown Vendor' }))
        .sort((a,b) => (a.unitPrice || Infinity) - (b.unitPrice || Infinity));

    // 1. Check for manual override
    if (overrideVendorId) {
        const overridePrice = prices.find(p => p.vendorId === overrideVendorId);
        if (overridePrice) {
             return {
                vendorId: overridePrice.vendorId,
                vendorName: overridePrice.vendorName,
                vendorItemNo: overridePrice.vendorItemNo || 'N/A',
                unitPrice: overridePrice.unitPrice,
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
            unitPrice: preferredPrice.unitPrice,
            status: 'Preferred'
        };
    }
    
    // 3. Find cheapest vendor that is "In Stock"
    const cheapestInStock = prices.find(p => p.vendorStatus === 'In Stock' || !p.vendorStatus);
    if (cheapestInStock) {
        return {
            vendorId: cheapestInStock.vendorId,
            vendorName: cheapestInStock.vendorName,
            vendorItemNo: cheapestInStock.vendorItemNo || 'N/A',
            unitPrice: cheapestInStock.unitPrice,
            status: 'Cheapest'
        };
    }

    // 4. Fallback: Use preferred vendor (even if backordered)
    if (preferredPrice) {
        return {
            vendorId: preferredPrice.vendorId,
            vendorName: preferredPrice.vendorName,
            vendorItemNo: preferredPrice.vendorItemNo || 'N/A',
            unitPrice: preferredPrice.unitPrice,
            status: `Preferred (${preferredPrice.vendorStatus || 'N/A'})`
        };
    }
    
    // 5. Fallback: Use cheapest vendor (even if backordered/out of stock)
    const cheapestOverall = prices[0];
    if (cheapestOverall) {
        return {
            vendorId: cheapestOverall.vendorId,
            vendorName: cheapestOverall.vendorName,
            vendorItemNo: cheapestOverall.vendorItemNo || 'N/A',
            unitPrice: cheapestOverall.unitPrice,
            status: `Cheapest (${cheapestOverall.vendorStatus || 'N/A'})`
        };
    }

    // 6. No pricing info
    return { vendorId: 'unassigned', vendorName: 'Unassigned / No Pricing', vendorItemNo: 'N/A', unitPrice: 0, status: 'No Pricing' };
}

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