// modules/auth.js
import { app } from "./firebase.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { state } from "./state.js";

const auth = getAuth(app);

// 24 hours inactivity auto-logout
const INACTIVITY_LIMIT = 24 * 60 * 60 * 1000;
let inactivityTimer = null;

function resetInactivity() {
  clearTimeout(inactivityTimer);
  if (state.user) {
    inactivityTimer = setTimeout(() => {
      alert("Session expired due to inactivity.");
      logout();
    }, INACTIVITY_LIMIT);
  }
}

["mousemove", "keydown", "click", "touchstart"].forEach(evt =>
  window.addEventListener(evt, resetInactivity)
);

// Google Sign-In function
export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    hd: "gemfireems.org"
  });

  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Login error:", err);
    alert("Login failed.");
  }
}

export function logout() {
  return signOut(auth);
}

// Fires on login/logout
export function onUserStateChanged(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user && user.email.endsWith("@gemfireems.org")) {
      state.user = user;
      resetInactivity(); // start inactivity timer
      callback(user);
    } else {
      state.user = null;
      callback(null);
    }
  });
}
