// modules/config.js
/**
 * Application configuration constants
 */

export const CONFIG = {
    // Authentication
    AUTH: {
        ALLOWED_DOMAIN: 'gemfireems.org',
        OAUTH_CLIENT_ID: '649560661195-m4c2sa1bncop9jnhajpvfum5dal3iqha.apps.googleusercontent.com',
        INACTIVITY_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours
        DEFAULT_ROLE: 'Staff'
    },
    
    // UI Settings
    UI: {
        SEARCH_DEBOUNCE_MS: 300,
        EDIT_SUCCESS_TIMEOUT_MS: 1500,
        EDIT_ERROR_TIMEOUT_MS: 1000,
        MAX_INPUT_LENGTH: 500
    },
    
    // Firestore Collections
    COLLECTIONS: {
        CATALOG: 'catalog',
        VENDORS: 'vendors',
        REQUESTS: 'requests',
        PRICING: 'vendorPricing',
        CATEGORIES: 'categories',
        UNITS: 'units',
        COMPARTMENTS: 'compartments',
        USERS: 'users'
    },
    
    // Request Statuses
    REQUEST_STATUS: {
        OPEN: 'Open',
        ORDERED: 'Ordered',
        BACKORDERED: 'Backordered',
        RECEIVED: 'Received',
        COMPLETED: 'Completed'
    },
    
    // Vendor Statuses
    VENDOR_STATUS: {
        IN_STOCK: 'In Stock',
        BACKORDERED: 'Backordered',
        OUT_OF_STOCK: 'Out of Stock'
    }
};
