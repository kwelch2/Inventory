// modules/app.js
import { state } from "./state.js";
import { onUserStateChanged, login, logout } from "./auth.js";
import { renderOrdersPanel, drawOrders } from "./ui/orders.js";
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
import { renderTabs } from "./ui/tabs.js";

function renderPanels() {
  document.getElementById("app").insertAdjacentHTML("beforeend", `
    <div id="panel-orders" class="panel">Loading orders…</div>
    <div id="panel-catalog" class="panel">Loading catalog…</div>
    <div id="panel-manage" class="panel">Loading management…</div>
  `);
}

function activateTab(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  
  if (name === "orders") $("#panel-orders").classList.add("active");
  if (name === "catalog") $("#panel-catalog").classList.add("active");
  if (name === "manage") $("#panel-manage").classList.add("active");
}
onUserStateChanged(async (user) => {
  if (user) {
    console.log("Logged in:", user.email);

    // UI shell
    renderTabs();
    renderPanels();
    activateTab("orders");

    // Listen for tab switching
    window.addEventListener("changeTab", (e) => {
      activateTab(e.detail);
    });

    // Load data
    await loadStaticData();
    listenToRequests(() => console.log("Requests updated"));
    listenToVendorPricing(() => console.log("Pricing updated"));
  }
});

renderTabs();
renderPanels();
renderOrdersPanel();  // <<< ADD THIS
activateTab("orders");

// refresh UI when data updates
listenToRequests(() => drawOrders());
listenToVendorPricing(() => drawOrders());

// TEMP LOGIN/LOGOUT BUTTONS
document.body.insertAdjacentHTML("beforeend", `
  <div style="margin-top:2rem; padding:1rem; border:1px solid #ccc;">
    <button id="loginBtn">Login with Google</button>
    <button id="logoutBtn">Logout</button>
  </div>
`);

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);
