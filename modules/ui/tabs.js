// modules/ui/tabs.js
import { $ } from "../helpers/utils.js";

export function mountTabs() {
    const TABS = ['Orders', 'Catalog', 'Management'];
    $('#tabs').innerHTML = TABS.map(t => `<button class="tab" data-tab="${t.toLowerCase().replace(' ', '_')}">${t}</button>`).join('');
    
    $('#tabs').addEventListener('click', (ev) => {
        const tabId = ev.target.dataset.tab; 
        if (!tabId) return;
        
        document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
        ev.target.classList.add('active'); 
        $(`#panel-${tabId}`).classList.add('active');
    });
    
    // Activate the first tab by default
    $('#tabs').querySelector('[data-tab="orders"]').click();
}

export function mountManagementTabs() {
    $('#mgmtSubTabs').addEventListener('click', (ev) => {
        const subTabId = ev.target.dataset.subtab;
        if (!subTabId) return;
        
        // Handle button active state
        $('#mgmtSubTabs').querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
        ev.target.classList.add('active');
        
        // Handle panel active state
        $('#panel-management').querySelectorAll('.sub-panel').forEach(panel => panel.classList.remove('active'));
        $(`#subpanel-${subTabId}`).classList.add('active');
    });
}