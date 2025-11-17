// modules/state.js

export const state = {
    user: null,
    role: null,

    // data collections
    catalog: [],
    vendors: [],
    categories: [],
    units: [],
    compartments: [],
    requests: [],
    pricing: [],

    // maps for fast lookup
    maps: {
        catalog: new Map(),
        vendors: new Map(),
        categories: new Map(),
        pricing: new Map(),
    },

    // view settings
    view: {
        ordersMode: "vendor"
    }
};
