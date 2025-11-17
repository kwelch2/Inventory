// modules/ui/modals.js
import { state } from "../state.js";
import { $, escapeHtml } from "../helpers/utils.js";

import {
  addCatalogItem,
  updateCatalogItem
} from "../firestoreApi.js";

let modalEl = null;

// ---------------------------
// OPEN MODAL (new or edit)
// ---------------------------
export function openCatalogModal(item = null) {
  closeCatalogModal(); // ensure no duplicates

  const isEdit = !!item;
  const vendors = state.vendors;
  const categories = state.categories;

  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay";

  modalEl.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? "Edit Item" : "Add New Item"}</h2>

      <label>Name:</label>
      <input id="m-name" value="${escapeHtml(item?.name || "")}">

      <label>Vendor:</label>
      <select id="m-vendor">
        <option value="">-- Select Vendor --</option>
        ${vendors.map(v => `
          <option value="${v.id}" ${v.id === item?.vendor ? "selected" : ""}>
            ${escapeHtml(v.name)}
          </option>`).join("")}
      </select>

      <label>Category:</label>
      <select id="m-category">
        <option value="">-- Select Category --</option>
        ${categories.map(c => `
          <option value="${c.id}" ${c.id === item?.category ? "selected" : ""}>
            ${escapeHtml(c.name)}
          </option>`).join("")}
      </select>

      <label>Min Level:</label>
      <input id="m-min" type="number" value="${item?.min ?? ""}">

      <label>Max Level:</label>
      <input id="m-max" type="number" value="${item?.max ?? ""}">

      <div class="modal-actions">
        <button id="m-cancel" class="button-secondary">Cancel</button>
        <button id="m-save" class="button-primary">${isEdit ? "Save" : "Add"}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  $("#m-cancel").addEventListener("click", closeCatalogModal);
  $("#m-save").addEventListener("click", () => saveCatalogItem(item?.id));
}

// ---------------------------
// CLOSE MODAL
// ---------------------------
export function closeCatalogModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
}

// ---------------------------
// SAVE (add or update)
// ---------------------------
async function saveCatalogItem(id) {
  const data = {
    name: $("#m-name").value.trim(),
    vendor: $("#m-vendor").value.trim(),
    category: $("#m-category").value.trim(),
    min: Number($("#m-min").value) || 0,
    max: Number($("#m-max").value) || 0
  };

  if (!data.name) return alert("Name required.");
  if (!data.vendor) return alert("Vendor required.");
  if (!data.category) return alert("Category required.");

  if (id) {
    await updateCatalogItem(id, data);
  } else {
    await addCatalogItem(data);
  }

  closeCatalogModal();
}
