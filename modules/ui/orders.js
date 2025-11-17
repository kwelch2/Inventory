// modules/ui/orders.js
import { state } from "../state.js";
import { $, escapeHtml } from "../helpers/utils.js";
import {
  updateRequestStatus,
  updateRequestQty
} from "../firestoreApi.js";

let currentMode = "vendor"; // or "item"

// ---------------------------
// PUBLIC ENTRY POINT
// ---------------------------
export function renderOrdersPanel() {
  const panel = $("#panel-orders");
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

// ---------------------------
// RENDER MAIN PANEL
// ---------------------------
export function drawOrders() {
  const container = $("#orders-content");
  if (!container) return;

  if (state.requests.length === 0) {
    container.innerHTML = `<p>No active requests.</p>`;
    return;
  }

  // Group based on mode
  const output = (currentMode === "vendor")
    ? renderByVendor()
    : renderByItem();

  container.innerHTML = output;
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
      const catalog = state.maps.catalog.get(req.catalogId);
      if (!catalog) return;

      const vendorId = catalog.vendor || "unknown";

      if (!groups.has(vendorId)) groups.set(vendorId, []);
      groups.get(vendorId).push(req);
    });

  let html = "";

  for (const [vendorId, reqs] of groups.entries()) {
    const vendor = state.maps.vendors.get(vendorId);
    const vendorName = vendor ? vendor.name : "Unknown Vendor";

    html += `<div class="vendor-block">
      <h2>${escapeHtml(vendorName)}</h2>
      <table class="orders-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const r of reqs) {
      const item = state.maps.catalog.get(r.catalogId);
      html += renderOrderRow(r, item);
    }

    html += `
        </tbody>
      </table>
    </div>`;
  }

  return html || "<p>No pending vendor requests.</p>";
}

// ---------------------------
// GROUP: BY ITEM
// ---------------------------
function renderByItem() {
  const groups = new Map();

  state.requests
    .filter(r => r.status !== "Received")
    .forEach(req => {
      const item = state.maps.catalog.get(req.catalogId);
      if (!item) return;

      if (!groups.has(req.catalogId)) groups.set(req.catalogId, []);
      groups.get(req.catalogId).push(req);
    });

  let html = "";

  for (const [catalogId, reqs] of groups.entries()) {
    const item = state.maps.catalog.get(catalogId);

    html += `
      <div class="item-block">
        <h2>${escapeHtml(item.name)}</h2>
        <table class="orders-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Qty</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const r of reqs) {
      html += renderOrderRow(r, item);
    }

    html += `
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
function renderOrderRow(req, item) {
  return `
    <tr data-id="${req.id}">
      <td>${escapeHtml(item.name)}</td>

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
// EVENTS
// ---------------------------
function attachRowEvents() {
  document.querySelectorAll(".qty-input").forEach(input => {
    input.addEventListener("change", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      const qty = Number(e.target.value);

      updateRequestQty(id, qty);
    });
  });

  document.querySelectorAll(".receive-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;

      await updateRequestStatus(id, "Received");

      // Redraw after marking received
      drawOrders();
    });
  });
}
