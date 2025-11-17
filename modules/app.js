// modules/app.js
import { state } from "./state.js";
import { onUserStateChanged, login, logout } from "./auth.js";
import { $ } from "./helpers/utils.js";
import { renderTabs, activateTab } from "./ui/tabs.js";
import { renderOrdersPanel, drawOrders } from "./ui/orders.js";

import {
  loadStaticData,
  listenToRequests,
  listenToVendorPricing
} from "./firestoreApi.js";

console.log("App starting…");

// Build empty panels container once
function renderPanels() {
  const app = document.getElementById("app");
  if (!app) return;

  app.insertAdjacentHTML("beforeend", `
    <div id="panel-orders" class="panel hidden">Loading orders…</div>
    <div id="panel-catalog" class="panel hidden">Loading catalog…</div>
    <div id="panel-management" class="panel hidden">Loading management…</div>
  `);
}

// MAIN APP INITIALIZATION — RUNS ONCE AFTER LOGIN
onUserStateChanged(async (user) => {
  if (!user) {
    console.log("Logged out.");
    state.user = null;
    return;
  }

  console.log("Logged in:", user.email);

  // --- BUILD UI ONCE ---
  document.getElementById("app").innerHTML = ""; // Clear startup text
  renderTabs();
  renderPanels();
  renderOrdersPanel();
  activateTab("orders");

  // Tab switching
  window.addEventListener("changeTab", (e) => {
    activateTab(e.detail);
  });

  // --- LOAD DATA ---
  await loadStaticData();

  // --- REALTIME LIVE UPDATES ---
  listenToRequests(() => drawOrders());
  listenToVendorPricing(() => drawOrders());
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
