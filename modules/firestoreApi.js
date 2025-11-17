// modules/firestoreApi.js
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { db } from "./firebase.js";
import { state } from "./state.js";

// --------------------------
// LOAD STATIC DATA
// --------------------------
export async function loadStaticData() {
  const [
    catSnap,
    vendorSnap,
    unitSnap,
    compSnap,
    catMgmtSnap
  ] = await Promise.all([
    getDocs(collection(db, "catalog")),
    getDocs(collection(db, "vendors")),
    getDocs(collection(db, "units")),
    getDocs(collection(db, "compartments")),
    getDocs(collection(db, "categories")),
  ]);

  state.catalog = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.vendors = vendorSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.units = unitSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.compartments = compSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.categories = catMgmtSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Maps for instant lookup
  state.maps.catalog = new Map(state.catalog.map(c => [c.id, c]));
  state.maps.vendors = new Map(state.vendors.map(v => [v.id, v]));
  state.maps.categories = new Map(state.categories.map(c => [c.id, c]));

  console.log("Static data loaded.");
}

// --------------------------
// REALTIME LISTENERS
// --------------------------
export function listenToRequests(callback) {
  return onSnapshot(collection(db, "requests"), (snap) => {
    state.requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(state.requests);
  });
}

export function listenToVendorPricing(callback) {
  return onSnapshot(collection(db, "vendorPricing"), (snap) => {
    state.pricing = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Pricing map
    const map = new Map();
    state.pricing.forEach(p => {
      if (!map.has(p.catalogId)) map.set(p.catalogId, []);
      map.get(p.catalogId).push(p);
    });
    state.maps.pricing = map;

    callback(state.pricing);
  });
}

// --------------------------
// REQUEST ACTIONS
// --------------------------
export async function updateRequestStatus(reqId, status) {
  const data = {
    status,
    updatedAt: serverTimestamp()
  };

  if (status === "Received") {
    data.receivedAt = serverTimestamp();
  }

  await updateDoc(doc(db, "requests", reqId), data);
}

export async function updateRequestQty(reqId, qty) {
  await updateDoc(doc(db, "requests", reqId), {
    qty,
    updatedAt: serverTimestamp()
  });
}

// --------------------------
// CATALOG ACTIONS
// --------------------------
export async function addCatalogItem(data) {
  data.createdAt = serverTimestamp();
  return addDoc(collection(db, "catalog"), data);
}

export async function updateCatalogItem(id, data) {
  data.updatedAt = serverTimestamp();
  return updateDoc(doc(db, "catalog", id), data);
}

// --------------------------
// VENDOR ACTIONS
// --------------------------
export async function addVendor(data) {
  data.createdAt = serverTimestamp();
  return addDoc(collection(db, "vendors"), data);
}

export async function updateVendor(id, data) {
  data.updatedAt = serverTimestamp();
  return updateDoc(doc(db, "vendors", id), data);
}

// --------------------------
// PRICING ACTIONS
// --------------------------
export async function addVendorPrice(data) {
  return addDoc(collection(db, "vendorPricing"), data);
}

export async function updateVendorPrice(id, data) {
  return updateDoc(doc(db, "vendorPricing", id), data);
}
