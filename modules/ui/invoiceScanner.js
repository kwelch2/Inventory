// modules/ui/invoiceScanner.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { state } from "../state.js"; 
import { db } from "../firebase.js"; 
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Improved prompt for text-based PDFs and layouts
    const prompt = `
    Analyze this invoice image or PDF document. Extract the Vendor Name and the table of Line Items.

    1. **Vendor Name**: Who is the bill from? (e.g. Henry Schein, Valor Health, etc.)
    2. **Line Items**: Look for a table structure. Rows often span multiple lines.
       - **Description**: The product name. Combine multi-line descriptions if they wrap.
       - **SKU**: The Vendor's item code or number. Often labeled "Item Code", "Line No", or just a number column.
       - **Qty**: The quantity ordered/shipped.
       - **Unit Price**: The price per item.

    **Special Instruction for PDF Layouts:** - Text might be sparse. Look for vertical alignment to identify columns. 
    - If a row says "160/Cn" or "10/Bx", include that in the description or ignore, but find the numeric Quantity (e.g. 1, 2, 10).
    
    **OUTPUT JSON:**
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
        
        console.log("Raw AI Response:", text);
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Gemini Error:", e);
        if (e.message.includes("404")) {
            alert("Model Error: 'gemini-2.5-flash' not found. Check API Key.");
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
    
    items.forEach((item, index) => {
        let match = state.catalog.find(c => {
            const prices = state.pricingAll ? state.pricingAll.filter(p => p.catalogId === c.id) : [];
            const skuMatch = item.sku && prices.some(p => p.vendorItemNo === item.sku);
            if (skuMatch) return true;
            const cName = c.itemName.toLowerCase();
            const iName = (item.item_name || "").toLowerCase();
            return cName.includes(iName) || iName.includes(cName);
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="text" value="${escapeHtml(item.item_name)}" class="inv-name" style="width:100%">
                <div class="muted" style="font-size:0.8em">SKU: <span class="inv-sku">${escapeHtml(item.sku || '')}</span></div>
            </td>
            <td>${item.qty || 0}</td>
            <td><input type="number" step="0.01" value="${item.unit_price || 0}" class="inv-price" style="width:80px"></td>
            <td>
                <select class="inv-action" data-index="${index}">
                    <option value="ignore">Ignore</option>
                    <option value="update_price" ${match ? 'selected' : ''}>Update Cost</option>
                    <option value="mark_ordered">Mark Ordered</option>
                    <option value="create_new" ${!match ? 'selected' : ''}>Create New Item</option>
                </select>
            </td>
            <td>
                <select class="inv-match" style="width: 150px;">
                    <option value="">-- Create New --</option>
                    ${state.catalog.map(c => `<option value="${c.id}" ${match && match.id === c.id ? 'selected' : ''}>${c.itemName}</option>`).join('')}
                </select>
            </td>
        `;
        tbody.appendChild(row);
    });

    $('#invoiceLoading').style.display = 'none';
    modal.style.display = 'flex';
    
    const confirmBtn = $('#confirmInvoiceImportBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.onclick = async () => {
        const rows = tbody.querySelectorAll('tr');
        const vendorName = $('#invoiceVendorName').textContent;
        let vendorId = state.vendors.find(v => v.name.toLowerCase().includes(vendorName.toLowerCase()))?.id;
        
        // If vendor doesn't exist, we can't properly link pricing yet. 
        // In a perfect world we'd create the vendor here too, but for now we skip pricing if no vendor.
        
        let processedCount = 0;

        for (const row of rows) {
            const action = row.querySelector('.inv-action').value;
            let matchId = row.querySelector('.inv-match').value;
            const price = parseFloat(row.querySelector('.inv-price').value);
            const itemName = row.querySelector('.inv-name').value;
            const sku = row.querySelector('.inv-sku').textContent;

            if (action === 'ignore') continue;

            // --- 1. Create New Catalog Item if requested ---
            if (action === 'create_new' || (!matchId && action !== 'ignore')) {
                const newCatalogItem = {
                    itemName: itemName,
                    itemRef: 'N/A',
                    unit: 'Each', // Default
                    packSize: 1,
                    parLevel: 0,
                    category: '',
                    createdAt: serverTimestamp(),
                    isActive: true
                };
                const docRef = await addDoc(collection(db, "catalog"), newCatalogItem);
                matchId = docRef.id;
                // Update local state temporarily for next iterations
                state.catalog.push({ id: matchId, ...newCatalogItem });
            }

            // --- 2. Update/Create Vendor Pricing ---
            if (vendorId && (action === 'update_price' || action === 'create_new')) {
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
            }

            // --- 3. Mark Requests as Ordered ---
            if (action === 'mark_ordered') {
                // Find matching OPEN requests
                const requests = state.requests.filter(r => 
                    (r.catalogId === matchId || (!r.catalogId && r.otherItemName === itemName)) && 
                    r.status === 'Open'
                );
                
                for (const req of requests) {
                    // Update to Ordered
                    await updateDoc(doc(db, "requests", req.id), { 
                        status: 'Ordered', 
                        lastOrdered: serverTimestamp(),
                        catalogId: matchId // Ensure it's linked now if it was unlisted
                    });
                }
            }
            processedCount++;
        }
        
        alert(`Processed ${processedCount} items.`);
        modal.style.display = 'none';
        location.reload(); // Simple way to refresh all lists
    };
}
