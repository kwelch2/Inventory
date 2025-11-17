// modules/ui/tabs.js
import { $ } from "../helpers/utils.js";

const TABS = [
  { id: "orders", label: "Orders" },
  { id: "catalog", label: "Catalog" },
  { id: "management", label: "Management" }
];

// Build the tab bar UI
export function renderTabs() {
  const tabsContainer = $("#tabs");
  if (!tabsContainer) return;

  tabsContainer.innerHTML = TABS.map(t => `
    <button class="tab-btn" data-tab="${t.id}">
      ${t.label}
    </button>
  `).join("");

  // Default
  activateTab("orders");

  // Clicking switches tabs
  tabsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;

    const tabId = btn.dataset.tab;
    activateTab(tabId);
  });
}

// Handles showing/hiding panels & highlighting active tab
export function activateTab(tabId) {
  // highlight active button
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // hide all
  document.querySelectorAll(".panel").forEach(panel => {
    panel.classList.add("hidden");
  });

  // show the correct one
  const activePanel = document.querySelector(`#panel-${tabId}`);
  if (activePanel) activePanel.classList.remove("hidden");

  // dispatch event so other modules know tab changed
  window.dispatchEvent(new CustomEvent("changeTab", { detail: tabId }));
}
