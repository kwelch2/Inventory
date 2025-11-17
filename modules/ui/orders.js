// modules/ui/orders.js
import { state } from "../state.js";
import { $, escapeHtml } from "../helpers/utils.js";
import {
  updateRequestStatus,
  updateRequestQty
} from "../firestoreApi.js";

let currentMode = "vendor"; // or "item"

// Called once when user logs in and UI shell is ready
export function renderOrdersPanel() {
  const panel = $("#panel-orders");
  if (!panel) return;

  panel.innerHTML = `
    <div class="orders-header">
      <button id="ordersByVendor" class="order-mode-btn">Group: Vendor</button>
      <button id="ordersByItem" class="order-mode-btn">Group: Item</button>
    </div>

    <div id="orders-content" class="orders-content">
      Loading…
    </div>
  `;

  $("#ordersByVendor").addEventListener("click", () => {
    currentMode = "vendor";
    drawOrders();
  });

  $("#ordersByItem").addEventListener("click", () => {
    currentMode = "item";
    drawOrders();
  });

  drawOrders();
}

// Draw on initial load & every Firestore update
export function drawOrders() {
  const container = $("#orders-content");
  if (!container) return;

  if (!state.requests.length) {
    container.innerHTML = `<p>No requests pending.</p>`;
    return;
  }

  container.innerHTML =
    currentMode === "vendor"
      ? renderByVendor()
      : renderByItem();

  attachRowEvents();
}

// ---------------------------
// GROUP: BY VENDOR
// ---------------------------
function renderByVendor() {
  const groups = new Map();

  state.requests
    .filter(r => r.status !== "Received")
    .forEach(req => {
      const item = state.maps.catalog.get(req.catalogId);
      if (!item) return;

      const vendorId = item.vendor || "unknown";

      if (!groups.has(vendorId)) groups.set(vendorId, []);
      groups.get(vendorId).push(req);
    });

  let html = "";

  for (const [vendorId, reqs] of groups.entries()) {
    const vendor = state.maps.vendors.get(vendorId);
    const vendorName = vendor ? vendor.name : "Unknown Vendor";

    html += `
      <div class="vendor-block">
        <h2>${escapeHtml(vendorName)}</h2>
        <table class="orders-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${reqs.map(r => renderRow(r)).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  return html || "<p>No requests pending.</p>";
}

// ---------------------------
// GROUP: BY ITEM
// ---------------------------
function renderByItem() {
  const groups = new Map();

  state.requests
    .filter(r => r.status !== "Received")
    .forEach(req => {
      if (!groups.has(req.catalogId)) groups.set(req.catalogId, []);
      groups.get(req.catalogId).push(req);
    });

  let html = "";

  for (const [catalogId, reqs] of groups.entries()) {
    const item = state.maps.catalog.get(catalogId);
    const itemName = item ? item.name : "Unknown Item";

    html += `
      <div class="item-block">
        <h2>${escapeHtml(itemName)}</h2>
        <table class="orders-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Qty</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${reqs.map(r => renderRow(r)).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  return html;
}

// ---------------------------
// ROW RENDERING
// ---------------------------
function renderRow(req) {
  const item = state.maps.catalog.get(req.catalogId);

  return `
    <tr data-id="${req.id}">
      <td>${escapeHtml(item?.name || "Unknown")}</td>
      <td>
        <input type="number" class="qty-input" value="${req.qty}" min="1" style="width:60px">
      </td>
      <td>${escapeHtml(req.notes || "")}</td>
      <td>
        <button class="receive-btn">Received</button>
      </td>
    </tr>
  `;
}

// ---------------------------
// ATTACH EVENTS
// ---------------------------
function attachRowEvents() {
  // Qty change
  document.querySelectorAll(".qty-input").forEach(input => {
    input.addEventListener("change", (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      const qty = Number(e.target.value);
      updateRequestQty(id, qty);
    });
  });

  // Mark as received
  document.querySelectorAll(".receive-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const id = row.dataset.id;
      updateRequestStatus(id, "Received");
    });
  });
}
