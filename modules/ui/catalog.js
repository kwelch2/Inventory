// modules/ui/catalog.js
import { state } from "../state.js";
import { $, $all, escapeHtml } from "../helpers/utils.js";
import { openCatalogModal } from "./modals.js";

export function renderCatalogPanel() {
  const panel = $("#panel-catalog");
  if (!panel) return;

  panel.innerHTML = `
    <div class="catalog-header">
      <button id="addItemBtn" class="button-primary">+ Add Item</button>
    </div>

    <table class="catalog-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Vendor</th>
          <th>Category</th>
          <th>Min</th>
          <th>Max</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="catalog-body">
      </tbody>
    </table>
  `;

  $("#addItemBtn").addEventListener("click", () => openCatalogModal());

  drawCatalogTable();
}

export function drawCatalogTable() {
  const body = $("#catalog-body");
  if (!body) return;

  if (!state.catalog.length) {
    body.innerHTML = `<tr><td colspan="6">No catalog items.</td></tr>`;
    return;
  }

  const vendors = state.maps.vendors;
  const categories = state.maps.categories;

  body.innerHTML = state.catalog.map(item => {
    const vendorName = vendors.get(item.vendor)?.name || "";
    const categoryName = categories.get(item.category)?.name || "";

    return `
      <tr data-id="${item.id}">
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(vendorName)}</td>
        <td>${escapeHtml(categoryName)}</td>
        <td>${item.min ?? ""}</td>
        <td>${item.max ?? ""}</td>
        <td>
          <button class="edit-btn">Edit</button>
        </td>
      </tr>
    `;
  }).join("");

  // Attach edit events
  $all(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.closest("tr").dataset.id;
      const item = state.maps.catalog.get(id);
      openCatalogModal(item);
    });
  });
}
