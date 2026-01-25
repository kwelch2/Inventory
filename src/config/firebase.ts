// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Note: In production, these values should be moved to environment variables
// For Firebase public hosting, these API keys are designed to be public
// Security is enforced through Firebase Security Rules, not key secrecy
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD7pMc-AHXb1cApzSfImkWvIjM9iwCoym4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "supplies-ems.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "supplies-ems",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "supplies-ems.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "649560661195",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:649560661195:web:f389f3e620c0c36559cf4e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-EN8MDYD571"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
