// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD7pMc-AHXb1cApzSfImkWvIjM9iwCoym4",
  authDomain: "supplies-ems.firebaseapp.com",
  projectId: "supplies-ems",
  storageBucket: "supplies-ems.firebasestorage.app",
  messagingSenderId: "649560661195",
  appId: "1:649560661195:web:f389f3e620c0c36559cf4e",
  measurementId: "G-EN8MDYD571"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
