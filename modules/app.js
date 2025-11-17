// modules/app.js
import { state } from "./state.js";
import { onUserStateChanged, login, logout } from "./auth.js";
import {
  loadStaticData,
  listenToRequests,
  listenToVendorPricing
} from "./firestoreApi.js";

console.log("App starting…");

// LOGIN / LOGOUT
onUserStateChanged(async (user) => {
  if (user) {
    console.log("Logged in:", user.email);

    // Load core data
    await loadStaticData();
    listenToRequests(() => console.log("Requests updated:", state.requests));
    listenToVendorPricing(() => console.log("Pricing updated:", state.pricing));

  } else {
    console.log("Logged out.");
    state.user = null;
  }
});

// TEMP LOGIN/LOGOUT BUTTONS
document.body.insertAdjacentHTML("beforeend", `
  <div style="margin-top:2rem; padding:1rem; border:1px solid #ccc;">
    <button id="loginBtn">Login with Google</button>
    <button id="logoutBtn">Logout</button>
  </div>
`);

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);
