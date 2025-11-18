// modules/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  // Add all the other functions we need
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  deleteField
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD7pMc-AHXb1cApzSfImkWvIjM9iwCoym4",
  authDomain: "supplies-ems.firebaseapp.com",
  projectId: "supplies-ems", // <-- This was misspelled as "suppies-ems"
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Re-export all the firestore functions so other modules can import from this file
export {
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  deleteField
};