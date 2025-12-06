// modules/ui/invoiceScanner.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { state } from "../state.js"; 
import { db } from "../firebase.js"; 
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
// FIX: Added escapeHtml to this import line
import { $, escapeHtml } from "../helpers/utils.js"; 

// === CONFIGURATION ===
let API_KEY = localStorage.getItem("GEMINI_API_KEY");

export function setupInvoiceScanner() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,application/pdf";
    fileInput.style.display = "none";
    fileInput.id = "invoiceFileInput";
    document.body.appendChild(fileInput);

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
    
    // Use the model we confirmed works for your key
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // --- UPDATED PROMPT FOR BETTER TABLE EXTRACTION ---
    const prompt = `
    You are an automated invoice data extractor. Your job is to extract the Vendor Name and a list of purchased Items from the provided image or PDF.

    1. **Vendor Name**: Identify who sent the invoice (e.g., "Valor Health", "Henry Schein", "Bound Tree", etc.).
    2. **Line Items**: Find the main table of items. Extract every row.
       - **Description**: Look for columns like "Description", "Item Name", or "Product".
       - **SKU**: Look for columns like "Item Code", "Material #", "Vendor #", or "Catalog #". If not found, leave empty.
       - **Quantity**: Look for "Qty", "Quantity", "Ord", or "Shipped". Ensure this is a number.
       - **Unit Price**: Look for "Price", "Unit Price", or "Net Price". Ensure this is a number.

    **Special Handling for complex layouts:**
    - If a row spans multiple lines (like Henry Schein PDFs), merge the description.
    - Ignore "Freight", "Shipping", "Tax", or "Total" summary lines unless they appear as line items in the main table.
    
    **OUTPUT FORMAT**:
    Return strictly a JSON Object with this exact structure (no markdown, no backticks):
    {
      "vendor_name": "String",
      "items": [
        {
          "item_name": "String",
          "sku": "String",
          "qty": Number,
          "unit_price": Number
        }
      ]
    }
    `;

    const filePart = await fileToGenerativePart(file);
    
    try {
        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();
        
        console.log("Raw AI Response:", text); // Debugging line to see what AI returns

        // Clean up markdown formatting if the AI adds it
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Gemini Error:", e);
        if (e.message.includes("404")) {
            alert("Model Error: 'gemini-2.5-flash' was not found. Please check your API Key permissions.");
        }
        throw e;
    }
}

function renderInvoiceReview(data) {
    const modal = $('#invoiceReviewModal');
    const tbody = $('#invoiceReviewTable tbody');
    tbody.innerHTML = '';
    
    $('#invoiceVendorName').textContent = data.vendor_name || "Unknown Vendor";
    
    const items = Array.isArray(data.items) ? data.items : [];
    
    if (items.length === 0) {
        alert("AI could not find any items in this document. Please check the console log for details.");
    }

    items.forEach((item, index) => {
        // Fuzzy Match Logic
        // 1. Try exact SKU match first
        // 2. Try partial Name match
        let match = state.catalog.find(c => {
            const prices = state.pricingAll ? state.pricingAll.filter(p => p.catalogId === c.id) : [];
            const skuMatch = item.sku && prices.some(p => p.vendorItemNo === item.sku);
            if (skuMatch) return true;
            
            // Loose name match
            const cName = c.itemName.toLowerCase();
            const iName = (item.item_name || "").toLowerCase();
            return cName.includes(iName) || iName.includes(cName);
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="text" value="${escapeHtml(item.item_name)}" class="inv-name" style="width:100%">
                <div class="muted" style="font-size:0.8em">SKU: ${escapeHtml(item.sku || '')}</div>
            </td>
            <td>${item.qty || 0}</td>
            <td><input type="number" step="0.01" value="${item.unit_price || 0}" class="inv-price" style="width:80px"></td>
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
    const confirmBtn = $('#confirmInvoiceImportBtn');
    const newBtn = confirmBtn.cloneNode(true); // Remove old listeners
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.onclick = async () => {
        const rows = tbody.querySelectorAll('tr');
        const vendorName = $('#invoiceVendorName').textContent;
        
        let vendorId = state.vendors.find(v => v.name.toLowerCase().includes(vendorName.toLowerCase()))?.id;
        
        for (const row of rows) {
            const action = row.querySelector('.inv-action').value;
            const matchId = row.querySelector('.inv-match').value;
            const price = parseFloat(row.querySelector('.inv-price').value);
            // Grab SKU securely
            const skuDiv = row.querySelector('.muted');
            const sku = skuDiv ? skuDiv.textContent.replace('SKU: ', '').trim() : '';

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