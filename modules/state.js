// modules/state.js

export const state = { 
    user: null, 
    userRole: null, 
    catalog: [], 
    vendors: [], 
    categories: [], 
    pricingAll: [], 
    requests: [], 
    units: [], 
    compartments: [], 
    catalogMap: new Map(), 
    vendorMap: new Map(), 
    categoryMap: new Map(), 
    pricingMap: new Map(),
    orderViewMode: 'vendor', // 'vendor' or 'item'
    // Firestore listener unsubscribe functions for cleanup
    unsubscribers: []
};