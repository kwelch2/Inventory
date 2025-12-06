// modules/ui/invoiceScanner.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { state } from "../state.js"; // Changed ./ to ../
import { db } from "../firebase.js";  // Changed ./ to ../
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { $ } from "../helpers/utils.js"; // Changed ./ to ../

// ... (The rest of the code remains exactly the same as before) ...

// === CONFIGURATION ===
let API_KEY = localStorage.getItem("GEMINI_API_KEY");

export function setupInvoiceScanner() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,application/pdf";
    fileInput.style.display = "none";
    fileInput.id = "invoiceFileInput";
    document.body.appendChild(fileInput);

    // Safety check: ensure button exists before adding listener
    const uploadBtn = $('#uploadInvoiceBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            if (!API_KEY) {
                const key = prompt("Please enter your Google Gemini API Key (it will be saved for future use):");
                if (key) {
                    API_KEY = key;
                    localStorage.setItem("GEMINI_API_KEY", key);
                } else {
                    return;
                }
            }
            fileInput.click();
        });
    }

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        $('#invoiceLoading').style.display = 'flex';
        try {
            const result = await processInvoiceWithGemini(file);
            renderInvoiceReview(result);
        } catch (err) {
            console.error(err);
            alert("Error processing invoice: " + err.message);
            $('#invoiceLoading').style.display = 'none';
        } finally {
            fileInput.value = ''; // Reset
        }
    });
}

async function fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}

async function processInvoiceWithGemini(file) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // UPDATE THIS LINE: Use the specific pinned version "gemini-1.5-flash-001"
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

    const prompt = `
    Analyze this invoice image or PDF. Extract the line items.
    Return a JSON array where each object has:
    - "item_name": The name/description of the item.
    - "sku": The vendor's item number/SKU (if visible).
    - "qty": The quantity ordered (number).
    - "unit_price": The price per unit (number).
    
    Also extract the "vendor_name" (string) for the whole invoice.
    
    IMPORTANT: Return ONLY the raw JSON string. Do not use Markdown code blocks.
    `;

    const filePart = await fileToGenerativePart(file);
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const text = response.text();
    
    // Clean up potential markdown formatting
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
}

function renderInvoiceReview(data) {
    const modal = $('#invoiceReviewModal');
    const tbody = $('#invoiceReviewTable tbody');
    tbody.innerHTML = '';
    
    $('#invoiceVendorName').textContent = data.vendor_name || "Unknown Vendor";
    
    // Try to match items to our catalog
    const items = Array.isArray(data) ? data : (data.items || []);
    
    items.forEach((item, index) => {
        // Simple fuzzy match by Vendor SKU or Name
        let match = state.catalog.find(c => {
            // Check Vendor Pricing for SKU match (if available)
            // Note: In state.pricingAll, we need to check if pricingAll is populated
            const prices = state.pricingAll ? state.pricingAll.filter(p => p.catalogId === c.id) : [];
            const skuMatch = prices.some(p => p.vendorItemNo === item.sku);
            return skuMatch || c.itemName.toLowerCase().includes(item.item_name.toLowerCase());
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="text" value="${escapeHtml(item.item_name)}" class="inv-name" style="width:100%">
                <div class="muted" style="font-size:0.8em">SKU: ${escapeHtml(item.sku)}</div>
            </td>
            <td>${item.qty}</td>
            <td><input type="number" step="0.01" value="${item.unit_price}" class="inv-price" style="width:80px"></td>
            <td>
                <select class="inv-action" data-index="${index}">
                    <option value="ignore">Ignore</option>
                    <option value="update_price" ${match ? 'selected' : ''}>Update Cost</option>
                    <option value="mark_ordered">Mark Ordered</option>
                </select>
            </td>
            <td>
                <select class="inv-match" style="width: 150px;">
                    <option value="">-- No Match --</option>
                    ${state.catalog.map(c => `<option value="${c.id}" ${match && match.id === c.id ? 'selected' : ''}>${c.itemName}</option>`).join('')}
                </select>
            </td>
        `;
        tbody.appendChild(row);
    });

    $('#invoiceLoading').style.display = 'none';
    modal.style.display = 'flex';
    
    // Setup Confirm Button
    // Remove existing listener to prevent duplicates if opened multiple times
    const confirmBtn = $('#confirmInvoiceImportBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.onclick = async () => {
        const rows = tbody.querySelectorAll('tr');
        const vendorName = $('#invoiceVendorName').textContent;
        
        let vendorId = state.vendors.find(v => v.name.toLowerCase().includes(vendorName.toLowerCase()))?.id;
        
        for (const row of rows) {
            const action = row.querySelector('.inv-action').value;
            const matchId = row.querySelector('.inv-match').value;
            const price = parseFloat(row.querySelector('.inv-price').value);
            const skuText = row.querySelector('.inv-name').nextElementSibling.textContent;
            const sku = skuText.replace('SKU: ','').trim();

            if (action === 'ignore' || !matchId) continue;

            if (action === 'update_price' && vendorId) {
                // Find existing price doc
                const existingPrice = state.pricingAll.find(p => p.catalogId === matchId && p.vendorId === vendorId);
                const priceData = {
                    catalogId: matchId,
                    vendorId: vendorId,
                    unitPrice: price,
                    vendorItemNo: sku,
                    updatedAt: serverTimestamp()
                };
                
                if (existingPrice) {
                    await updateDoc(doc(db, "vendorPricing", existingPrice.id), { unitPrice: price, updatedAt: serverTimestamp() });
                } else {
                    await addDoc(collection(db, "vendorPricing"), priceData);
                }
            } else if (action === 'mark_ordered') {
                // Find open request for this item
                const req = state.requests.find(r => r.catalogId === matchId && r.status === 'Open');
                if (req) {
                    await updateDoc(doc(db, "requests", req.id), { status: 'Ordered', lastOrdered: serverTimestamp() });
                }
            }
        }
        
        alert("Import processing complete.");
        modal.style.display = 'none';
    };
}