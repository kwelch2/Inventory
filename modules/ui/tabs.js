// modules/ui/tabs.js
import { $ } from "../helpers/utils.js";

export function renderTabs() {
  const html = `
    <nav class="top-tabs">
      <button class="tab-btn" data-tab="orders">Orders</button>
      <button class="tab-btn" data-tab="catalog">Catalog</button>
      <button class="tab-btn" data-tab="manage">Management</button>
    </nav>
  `;

  document.getElementById("app").insertAdjacentHTML("afterbegin", html);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      window.dispatchEvent(new CustomEvent("changeTab", { detail: tab }));
    });
  });
}
