import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, updateDoc, addDoc, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useInventoryData } from '../hooks/useInventoryData';
import type { CatalogItem, Vendor, VendorPrice } from '../types';
import './AdminPage.css';

type AdminTab = 'orders' | 'catalog' | 'settings';
type OrderView = 'item' | 'vendor';

export const AdminPage = () => {
  const { user, loading } = useAuth();
  const { catalog, vendors, categories, compartments, requests, pricing, units, loading: dataLoading } = useInventoryData();
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  
  // Orders tab state
  const [orderView, setOrderView] = useState<OrderView>('item');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [editingQty, setEditingQty] = useState<{ id: string; qty: string; unit: string } | null>(null);
  const [editingVendorOverride, setEditingVendorOverride] = useState<{ id: string; vendorId: string } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showOrderPreview, setShowOrderPreview] = useState(false);
  const [orderPreviewData, setOrderPreviewData] = useState<{ vendorId: string; vendorName: string; items: any[] } | null>(null);
  const [includePricing, setIncludePricing] = useState(false);
  const [expandHistorySection, setExpandHistorySection] = useState(false);
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  
  // Catalog tab state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all');
  const [catalogActiveFilter, setCatalogActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ itemId: string; price?: VendorPrice } | null>(null);
  
  // Settings tab state
  const [settingsSection, setSettingsSection] = useState<'units' | 'compartments' | 'categories' | 'vendors'>('vendors');
  const [newItemName, setNewItemName] = useState('');
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  
  // New request modal state
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestForm, setNewRequestForm] = useState({
    catalogId: '',
    qty: '',
    unit: '',
    notes: '',
    isOtherItem: false,
    otherItemName: ''
  });
  
  // Form states
  const [catalogForm, setCatalogForm] = useState({
    itemName: '',
    itemRef: '',
    category: '',
    unit: '',
    packSize: '',
    parLevel: '',
    isActive: true,
    altNames: ''
  });
  
  const [pricingForm, setPricingForm] = useState({
    vendorId: '',
    unitPrice: '',
    vendorOrderNumber: '',
    vendorStatus: 'In Stock' as 'In Stock' | 'Backordered' | 'Out of Stock'
  });
  
  const [vendorForm, setVendorForm] = useState({
    name: '',
    phone: '',
    email: '',
    webUrl: '',
    accountNumber: '',
    serviceFee: '',
    notes: ''
  });

  // Create maps for fast lookups
  const catalogMap = useMemo(() => new Map(catalog.map(item => [item.id, item])), [catalog]);
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  
  // Map catalog items by their catalogId field for quick lookup
  const catalogByCatalogId = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    catalog.forEach(item => {
      const catId = (item as any).catalogId;
      if (catId) map.set(catId, item);
    });
    return map;
  }, [catalog]);
  
  // Pricing map keyed by catalogId (the field in vendorPricing collection)
  const pricingMap = useMemo(() => {
    const map = new Map<string, VendorPrice[]>();
    pricing.forEach(p => {
      const key = p.catalogId || (p as any).itemId; // Prefer catalogId, fallback to itemId
      if (key) {
        const existing = map.get(key) || [];
        existing.push(p);
        map.set(key, existing);
      }
    });
    return map;
  }, [pricing]);

  if (loading) {
    return <div className="admin-loading"><p>Loading...</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  const isAuthorized = user.email?.endsWith('@gemfireems.org');
  if (!isAuthorized) {
    return (
      <div className="page-container">
        <div className="content-card error-card">
          <h1>Access Denied</h1>
          <p>You must have a @gemfireems.org email to access the admin panel.</p>
        </div>
      </div>
    );
  }

  // ===================== HELPER FUNCTIONS =====================
  const getItemName = (request: any) => {
    if (request.otherItemName) return request.otherItemName;
    const item = catalogByCatalogId.get(request.catalogId);
    if (item) return item.itemName;
    const itemById = catalogMap.get(request.itemId);
    return itemById?.itemName || 'Unknown Item';
  };

  const getItemPricing = (catalogId?: string) => {
    if (catalogId) {
      return pricingMap.get(catalogId) || [];
    }
    return [];
  };

  const getCatalogItemPricing = (item: CatalogItem) => {
    // First try the catalogId field, then fall back to item.id
    const catId = (item as any).catalogId;
    if (catId && pricingMap.has(catId)) {
      return pricingMap.get(catId) || [];
    }
    return pricingMap.get(item.id) || [];
  };

  // ===================== ORDER FUNCTIONS =====================
  // Separate requests into sections
  const openRequests = useMemo(() => {
    return requests
      .filter(r => (r.status || 'Open') === 'Open')
      .sort((a, b) => getItemName(a).localeCompare(getItemName(b)));
  }, [requests, catalog]);

  const orderedRequests = useMemo(() => {
    return requests
      .filter(r => r.status === 'Ordered')
      .sort((a, b) => getItemName(a).localeCompare(getItemName(b)));
  }, [requests, catalog]);

  const backorderRequests = useMemo(() => {
    return requests
      .filter(r => r.status === 'Backordered')
      .sort((a, b) => getItemName(a).localeCompare(getItemName(b)));
  }, [requests, catalog]);

  const historyRequests = useMemo(() => {
    const historyStatuses = ['Received', 'Completed', 'Closed', 'Cancelled'];
    return requests
      .filter(r => historyStatuses.includes(r.status || ''))
      .sort((a, b) => {
        const aDate = a.receivedAt && typeof a.receivedAt === 'object' && 'seconds' in a.receivedAt ? a.receivedAt.seconds : 0;
        const bDate = b.receivedAt && typeof b.receivedAt === 'object' && 'seconds' in b.receivedAt ? b.receivedAt.seconds : 0;
        return bDate - aDate; // Most recent first
      });
  }, [requests]);

  // Legacy filtered requests for backward compatibility
  const filteredRequests = useMemo(() => {
    const historyStatuses = ['Received', 'Completed', 'Closed', 'Cancelled'];
    let filtered = [...requests];

    // Filter out history requests (they're shown in separate section)
    filtered = filtered.filter(r => !historyStatuses.includes(r.status || ''));

    // Sort by status priority then by item name
    const sortOrder: Record<string, number> = { Open: 1, Backordered: 2, Ordered: 3 };
    filtered.sort((a, b) => {
      const aStatus = a.status || 'Open';
      const bStatus = b.status || 'Open';
      const aOrder = sortOrder[aStatus] || 99;
      const bOrder = sortOrder[bStatus] || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return getItemName(a).localeCompare(getItemName(b));
    });

    return filtered;
  }, [requests, catalog]);

  // Group requests by vendor AND status for vendor view sections
  const requestsByVendorAndStatus = useMemo(() => {
    const grouped = new Map<string, {
      vendorName: string;
      open: any[];
      ordered: any[];
      backordered: any[];
      history: any[];
    }>();

    const historyStatuses = ['Received', 'Completed', 'Closed', 'Cancelled'];
    const allRequests = [...requests];

    allRequests.forEach(r => {
      // Get vendor info
      const prices = r.catalogId ? pricingMap.get(r.catalogId) || [] : [];
      const bestPrice = prices.length > 0 ? prices.sort((a, b) => (a.unitPrice || Infinity) - (b.unitPrice || Infinity))[0] : null;
      
      let vendorId = 'unassigned';
      let vendorName = 'Unassigned';
      
      if (r.overrideVendorId) {
        vendorId = r.overrideVendorId;
        vendorName = vendorMap.get(r.overrideVendorId)?.name || 'Unknown Vendor';
      } else if (bestPrice) {
        vendorId = bestPrice.vendorId;
        vendorName = vendorMap.get(bestPrice.vendorId)?.name || 'Unknown Vendor';
      } else if (r.otherItemName) {
        vendorId = 'unlisted';
        vendorName = 'Unlisted / Custom';
      }

      if (!grouped.has(vendorId)) {
        grouped.set(vendorId, { vendorName, open: [], ordered: [], backordered: [], history: [] });
      }

      const group = grouped.get(vendorId)!;
      const status = r.status || 'Open';

      if (historyStatuses.includes(status)) {
        group.history.push(r);
      } else if (status === 'Ordered') {
        group.ordered.push(r);
      } else if (status === 'Backordered') {
        group.backordered.push(r);
      } else {
        group.open.push(r);
      }
    });

    return grouped;
  }, [requests, pricingMap, vendorMap]);


  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus, updatedAt: serverTimestamp() };
      if (newStatus === 'Received') {
        updateData.receivedAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'requests', requestId), updateData);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleQtyUpdate = async (requestId: string, qty: string, unit: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        qty,
        unit,
        updatedAt: serverTimestamp()
      });
      setEditingQty(null);
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity');
    }
  };

  const handleVendorOverride = async (requestId: string, vendorId: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        overrideVendorId: vendorId || null,
        updatedAt: serverTimestamp()
      });
      setEditingVendorOverride(null);
    } catch (error) {
      console.error('Error updating vendor override:', error);
      alert('Failed to update vendor');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;
    try {
      await deleteDoc(doc(db, 'requests', requestId));
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Failed to delete request');
    }
  };

  // Get the effective vendor for a request (override or best price)
  const getEffectiveVendor = (r: any) => {
    if (r.overrideVendorId) {
      return { vendorId: r.overrideVendorId, vendor: vendorMap.get(r.overrideVendorId) };
    }
    const prices = getItemPricing(r.catalogId);
    if (prices.length > 0) {
      const bestPrice = prices.sort((a, b) => (a.unitPrice || Infinity) - (b.unitPrice || Infinity))[0];
      return { vendorId: bestPrice.vendorId, vendor: vendorMap.get(bestPrice.vendorId) };
    }
    return { vendorId: null, vendor: null };
  };

  // Generate order for selected items - can be called from item view or vendor view
  const openOrderPreview = (vendorId?: string, vendorName?: string) => {
    // Get selected requests
    const selected = filteredRequests.filter(r => selectedRequests.has(r.id));
    
    if (selected.length === 0) {
      alert('Please select items to include in the order');
      return;
    }

    // Group by vendor if no specific vendor provided
    if (!vendorId) {
      // Group selected items by their effective vendor
      const byVendor = new Map<string, { vendorName: string; items: any[] }>();
      
      selected.forEach(r => {
        const { vendorId: vId, vendor } = getEffectiveVendor(r);
        const vKey = vId || 'unassigned';
        const vName = vendor?.name || 'Unassigned';
        
        if (!byVendor.has(vKey)) {
          byVendor.set(vKey, { vendorName: vName, items: [] });
        }
        
        const prices = getItemPricing(r.catalogId);
        const vendorPrice = prices.find(p => p.vendorId === vKey) || prices[0];
        
        byVendor.get(vKey)!.items.push({
          ...r,
          itemName: getItemName(r),
          vendorOrderNumber: vendorPrice?.vendorOrderNumber || '',
          unitPrice: vendorPrice?.unitPrice || 0
        });
      });

      // If all selected items are from one vendor, show that
      if (byVendor.size === 1) {
        const [vId, group] = Array.from(byVendor.entries())[0];
        setOrderPreviewData({ vendorId: vId, vendorName: group.vendorName, items: group.items });
      } else {
        // Multiple vendors - show first one but alert user
        const [vId, group] = Array.from(byVendor.entries())[0];
        alert(`Selected items span ${byVendor.size} vendors. Showing order for ${group.vendorName}. Generate orders separately for each vendor.`);
        setOrderPreviewData({ vendorId: vId, vendorName: group.vendorName, items: group.items });
      }
    } else {
      // Specific vendor provided (from vendor view)
      const vendorItems = selected.filter(r => {
        const { vendorId: vId } = getEffectiveVendor(r);
        return vId === vendorId;
      });

      const items = vendorItems.map(r => {
        const prices = getItemPricing(r.catalogId);
        const vendorPrice = prices.find(p => p.vendorId === vendorId) || prices[0];
        return {
          ...r,
          itemName: getItemName(r),
          vendorOrderNumber: vendorPrice?.vendorOrderNumber || '',
          unitPrice: vendorPrice?.unitPrice || 0
        };
      });

      setOrderPreviewData({ vendorId, vendorName: vendorName || 'Unknown', items });
    }
    
    setShowOrderPreview(true);
  };


  const handlePrintOrder = () => {
    if (!orderPreviewData) return;
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    const fullDateStr = today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Generate table rows
    const tableRows = orderPreviewData.items.map((item) => {
      const catalogItem = item.catalogId ? catalogByCatalogId.get(item.catalogId) : null;
      const itemRef = catalogItem?.itemRef || 'N/A';
      
      if (includePricing) {
        return `
          <tr>
            <td>${item.itemName}</td>
            <td>${itemRef}</td>
            <td>${item.vendorOrderNumber || 'N/A'}</td>
            <td>${item.qty || item.quantity || '1'} ${item.unit || ''}</td>
            <td>$${item.unitPrice ? item.unitPrice.toFixed(2) : '0.00'}</td>
          </tr>
        `;
      } else {
        return `
          <tr>
            <td>${item.itemName}</td>
            <td>${itemRef}</td>
            <td>${item.vendorOrderNumber || 'N/A'}</td>
            <td>${item.qty || item.quantity || '1'} ${item.unit || ''}</td>
          </tr>
        `;
      }
    }).join('');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>EMS Order - ${dateStr}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            
            .header {
              display: flex;
              align-items: center;
              gap: 20px;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #000;
            }
            
            .logo {
              width: 80px;
              height: 80px;
              flex-shrink: 0;
            }
            
            .org-info {
              flex: 1;
            }
            
            .org-info h1 {
              font-size: 18px;
              color: #0066cc;
              margin-bottom: 5px;
            }
            
            .org-info p {
              font-size: 12px;
              line-height: 1.4;
              color: #333;
            }
            
            .title {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin: 20px 0;
            }
            
            .order-details {
              margin-bottom: 20px;
            }
            
            .order-details p {
              margin: 8px 0;
              font-size: 14px;
            }
            
            .order-details strong {
              display: inline-block;
              width: 140px;
            }
            
            .order-section-title {
              font-weight: bold;
              font-size: 16px;
              margin: 20px 0 10px 0;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
              font-size: 13px;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #ccc;
            }
            
            @media print {
              body {
                padding: 10px;
              }
              
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/Logo-1.jpg" alt="Gem County FIRE-EMS Logo" class="logo" />
            <div class="org-info">
              <h1>Gem County FIRE-EMS</h1>
              <p>
                Station 4: 330 E. Main st<br>
                Emmett, Idaho 83617<br>
                Phone: 208-365-3684
              </p>
            </div>
          </div>
          
          <div class="title">EMS Order - ${dateStr}</div>
          
          <div class="order-details">
            <p><strong>Vendor:</strong> ${orderPreviewData.vendorName}</p>
            <p><strong>Date:</strong> ${fullDateStr}</p>
          </div>
          
          <div class="order-section-title">Order for: ${orderPreviewData.vendorName}</div>
          
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Ref #</th>
                <th>Vendor Item #</th>
                <th>Quantity Needed</th>
                ${includePricing ? '<th>Unit Price</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            <p style="font-size: 12px; color: #666;">
              <strong>Requested By:</strong> ${user?.email || ''}
            </p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait a moment for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleEmailOrder = () => {
    if (!orderPreviewData) return;
    
    const vendor = vendorMap.get(orderPreviewData.vendorId);
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const email = vendor?.email || '';
    
    // Generate plain text formatted email body (Gmail URL doesn't support HTML)
    let textBody = `EMS ORDER REQUEST\n`;
    textBody += `${'='.repeat(60)}\n\n`;
    textBody += `From: Gem County FIRE-EMS\n`;
    textBody += `      Station 4: 330 E. Main st\n`;
    textBody += `      Emmett, Idaho 83617\n`;
    textBody += `      Phone: 208-365-3684\n\n`;
    textBody += `Date: ${dateStr}\n`;
    textBody += `Requested By: ${user?.email || ''}\n`;
    
    if (vendor?.accountNumber) {
      textBody += `Account #: ${vendor.accountNumber}\n`;
    }
    
    textBody += `\n${'='.repeat(60)}\n`;
    textBody += `ORDER FOR: ${orderPreviewData.vendorName}\n`;
    textBody += `${'='.repeat(60)}\n\n`;
    
    // Create table header with pricing option
    if (includePricing) {
      textBody += `ITEM NAME                          | REF #      | VENDOR #   | QTY  | UOI  | PRICE    \n`;
      textBody += `${'-'.repeat(100)}\n`;
    } else {
      textBody += `ITEM NAME                          | REF #      | VENDOR #   | QTY  | UOI\n`;
      textBody += `${'-'.repeat(95)}\n`;
    }
    
    orderPreviewData.items.forEach(item => {
      const catalogItem = item.catalogId ? catalogByCatalogId.get(item.catalogId) : null;
      const itemRef = catalogItem?.itemRef || 'N/A';
      const qty = item.qty || item.quantity || '1';
      const uoi = item.unit || '';
      const vendorNum = item.vendorOrderNumber || 'N/A';
      
      // Format with padding for alignment
      const nameCol = item.itemName.padEnd(35).substring(0, 35);
      const refCol = itemRef.padEnd(11).substring(0, 11);
      const vendorCol = vendorNum.padEnd(11).substring(0, 11);
      const qtyCol = qty.padEnd(5).substring(0, 5);
      const uoiCol = uoi.padEnd(5).substring(0, 5);
      
      if (includePricing) {
        const price = item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : 'N/A';
        textBody += `${nameCol}| ${refCol}| ${vendorCol}| ${qtyCol}| ${uoiCol}| ${price}\n`;
      } else {
        textBody += `${nameCol}| ${refCol}| ${vendorCol}| ${qtyCol}| ${uoi}\n`;
      }
    });
    
    if (includePricing) {
      const subtotal = orderPreviewData.items.reduce((sum, item) => {
        const qty = parseFloat(item.qty || item.quantity || '1') || 1;
        return sum + (qty * (item.unitPrice || 0));
      }, 0);
      const fee = vendor?.serviceFee ? subtotal * (vendor.serviceFee / 100) : 0;
      
      textBody += `\n${'='.repeat(60)}\n`;
      textBody += `SUBTOTAL: $${subtotal.toFixed(2)}\n`;
      if (vendor?.serviceFee) {
        textBody += `Service Fee (${vendor.serviceFee}%): $${fee.toFixed(2)}\n`;
        textBody += `TOTAL: $${(subtotal + fee).toFixed(2)}\n`;
      }
    }
    
    textBody += `\n${'='.repeat(60)}\n\n`;
    textBody += `Thank you,`;
    
    const subject = encodeURIComponent(`EMS Order - ${orderPreviewData.vendorName} - ${dateStr}`);
    const encodedBody = encodeURIComponent(textBody);
    
    // Open Gmail compose - when Gmail opens, you can select your work account
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${encodedBody}`;
    window.open(gmailUrl, '_blank');
  };

  const handleMarkOrdered = async () => {
    if (!orderPreviewData) return;
    
    try {
      const updates = orderPreviewData.items.map(item => 
        updateDoc(doc(db, 'requests', item.id), {
          status: 'Ordered',
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(updates);
      setShowOrderPreview(false);
      setSelectedRequests(new Set());
      alert('Items marked as Ordered!');
    } catch (error) {
      console.error('Error marking as ordered:', error);
      alert('Failed to update status');
    }
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Helper to render order table rows with consistent logic
  const renderOrderRow = (r: any, rowClassName: string = '') => {
    const itemName = getItemName(r);
    const status = r.status || 'Open';
    const isEditable = status === 'Open' || status === 'Backordered';
    const prices = getItemPricing(r.catalogId);
    const { vendorId: effectiveVendorId, vendor: effectiveVendor } = getEffectiveVendor(r);
    const effectivePrice = prices.find(p => p.vendorId === effectiveVendorId) || prices[0];
    const catalogItem = r.catalogId ? catalogByCatalogId.get(r.catalogId) : null;
    const defaultUnit = catalogItem?.unit || '';
    const isExpanded = expandedRows.has(r.id);

    return (
      <React.Fragment key={r.id}>
        <tr className={rowClassName}>
          <td>
            <input
              type="checkbox"
              checked={selectedRequests.has(r.id)}
              onChange={(e) => {
                const next = new Set(selectedRequests);
                if (e.target.checked) next.add(r.id);
                else next.delete(r.id);
                setSelectedRequests(next);
              }}
            />
          </td>
          <td>
            <strong>{itemName}</strong>
            {r.otherItemName && <span className="tag unlisted-tag">Unlisted</span>}
            <button className="btn-expand" onClick={() => toggleRowExpand(r.id)}>
              {isExpanded ? '▲' : '▼'}
            </button>
            <br />
            {editingVendorOverride?.id === r.id && editingVendorOverride ? (
              <div className="vendor-edit-inline">
                <select
                  value={editingVendorOverride.vendorId}
                  onChange={(e) => setEditingVendorOverride({ id: editingVendorOverride.id, vendorId: e.target.value })}
                  autoFocus
                >
                  <option value="">Auto (Best Price)</option>
                  {prices.map(p => {
                    const v = vendorMap.get(p.vendorId);
                    return (
                      <option key={p.vendorId} value={p.vendorId}>
                        {v?.name || 'Unknown'} - ${p.unitPrice?.toFixed(2) || '?'}
                      </option>
                    );
                  })}
                  {prices.length === 0 && vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <button className="btn btn-small" onClick={() => handleVendorOverride(r.id, editingVendorOverride.vendorId)}>✓</button>
                <button className="btn btn-small" onClick={() => setEditingVendorOverride(null)}>✗</button>
              </div>
            ) : (
              <span
                className={`vendor-link ${isEditable ? 'editable' : ''} ${r.overrideVendorId ? 'override' : ''}`}
                onClick={() => isEditable && setEditingVendorOverride({ id: r.id, vendorId: r.overrideVendorId || '' })}
                title={isEditable ? 'Click to change vendor' : ''}
              >
                {effectiveVendor?.name || 'Unassigned'}
                {r.overrideVendorId && <span className="override-badge">Override</span>}
              </span>
            )}
          </td>
          <td>
            {editingQty?.id === r.id && editingQty ? (
              <div className="qty-edit-inline">
                <input
                  type="text"
                  value={editingQty.qty}
                  onChange={(e) => setEditingQty({ id: editingQty.id, qty: e.target.value, unit: editingQty.unit })}
                  style={{ width: '50px' }}
                  autoFocus
                />
                <select
                  value={editingQty.unit}
                  onChange={(e) => setEditingQty({ id: editingQty.id, qty: editingQty.qty, unit: e.target.value })}
                  style={{ width: '80px' }}
                >
                  <option value="">UOI...</option>
                  <option value="Each">Each</option>
                  <option value="Box">Box</option>
                  <option value="Case">Case</option>
                  <option value="Kit">Kit</option>
                  <option value="Brick">Brick</option>
                  <option value="Bag">Bag</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Pack">Pack</option>
                  <option value="Vial">Vial</option>
                  <option value="Tube">Tube</option>
                  <option value="Roll">Roll</option>
                  <option value="Pair">Pair</option>
                </select>
                <button className="btn btn-small" onClick={() => handleQtyUpdate(r.id, editingQty.qty, editingQty.unit)}>✓</button>
                <button className="btn btn-small" onClick={() => setEditingQty(null)}>✗</button>
              </div>
            ) : (
              <span
                className={`qty-display ${isEditable ? 'editable' : ''}`}
                onClick={() => isEditable && setEditingQty({ id: r.id, qty: r.qty || r.quantity || '', unit: r.unit || defaultUnit })}
                title={isEditable ? 'Click to edit' : ''}
              >
                {r.qty || r.quantity || '—'} {r.unit || ''}
              </span>
            )}
          </td>
          <td>{effectivePrice?.vendorOrderNumber || 'N/A'}</td>
          <td>{effectivePrice?.unitPrice ? `$${effectivePrice.unitPrice.toFixed(2)}` : 'N/A'}</td>
          <td>
            <div className="status-buttons">
              {['Open', 'Ordered', 'Backordered'].map(s => (
                <button
                  key={s}
                  className={`btn btn-status ${status === s ? 'active' : ''}`}
                  onClick={() => handleStatusChange(r.id, s)}
                >
                  {s}
                </button>
              ))}
              <button
                className="btn btn-status-receive"
                onClick={() => handleStatusChange(r.id, 'Received')}
              >
                Received
              </button>
            </div>
            <div className="edit-buttons">
              <button className="btn btn-small btn-danger" onClick={() => handleDeleteRequest(r.id)}>Delete</button>
            </div>
          </td>
        </tr>
        {isExpanded && (
          <tr className="details-row">
            <td colSpan={6}>
              <div className="vendor-pricing-details">
                <h4>All Vendor Pricing</h4>
                {prices.length > 0 ? (
                  <div className="price-tags">
                    {prices.map((p, idx) => {
                      const vendor = vendorMap.get(p.vendorId);
                      const fee = vendor?.serviceFee || 0;
                      const effectivePrice = (p.unitPrice || 0) * (1 + fee / 100);
                      return (
                        <span key={idx} className="price-tag">
                          {vendor?.name || 'Unknown'}: ${effectivePrice.toFixed(2)}
                          {fee > 0 && <span className="fee-note"> (incl. {fee}%)</span>}
                          <span className="vendor-item-no"> #{p.vendorOrderNumber || 'N/A'}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">No pricing information available.</p>
                )}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const openNewRequest = () => {
    setNewRequestForm({
      catalogId: '',
      qty: '',
      unit: '',
      notes: '',
      isOtherItem: false,
      otherItemName: ''
    });
    setShowNewRequestModal(true);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data: any = {
        status: 'Open',
        requesterEmail: user?.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (newRequestForm.isOtherItem) {
        if (!newRequestForm.otherItemName.trim()) {
          alert('Please enter an item name');
          return;
        }
        data.otherItemName = newRequestForm.otherItemName.trim();
      } else {
        if (!newRequestForm.catalogId) {
          alert('Please select an item');
          return;
        }
        data.catalogId = newRequestForm.catalogId;
        
        // Check for existing orders/backorders
        const existingOrdered = requests.find(r => 
          r.catalogId === newRequestForm.catalogId && 
          (r.status === 'Ordered' || r.status === 'Backordered')
        );
        if (existingOrdered) {
          const itemName = catalog.find(c => c.id === newRequestForm.catalogId)?.itemName || 'This item';
          const confirmMsg = `⚠️ WARNING: ${itemName} already has a ${existingOrdered.status} request.\n\nYou may be placing a duplicate order from another vendor.\n\nDo you want to continue?`;
          if (!confirm(confirmMsg)) {
            return;
          }
        }
      }

      if (newRequestForm.qty) {
        data.qty = newRequestForm.qty;
      }
      if (newRequestForm.unit) {
        data.unit = newRequestForm.unit;
      }
      if (newRequestForm.notes) {
        data.notes = newRequestForm.notes;
      }

      await addDoc(collection(db, 'requests'), data);
      setShowNewRequestModal(false);
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Failed to create request');
    }
  };

  // ===================== CATALOG FUNCTIONS =====================
  const filteredCatalog = useMemo(() => {
    let filtered = [...catalog];

    // Search filter
    if (catalogSearch) {
      const search = catalogSearch.toLowerCase();
      filtered = filtered.filter(item =>
        item.itemName.toLowerCase().includes(search) ||
        (item.altNames || []).some(alt => alt.toLowerCase().includes(search)) ||
        (item.itemRef || '').toLowerCase().includes(search)
      );
    }

    // Category filter
    if (catalogCategoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === catalogCategoryFilter);
    }

    // Active filter
    if (catalogActiveFilter === 'active') {
      filtered = filtered.filter(item => item.active !== false);
    } else if (catalogActiveFilter === 'inactive') {
      filtered = filtered.filter(item => item.active === false);
    }

    // Sort: active first, then alphabetical
    filtered.sort((a, b) => {
      const aActive = a.active !== false;
      const bActive = b.active !== false;
      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.itemName.localeCompare(b.itemName);
    });

    return filtered;
  }, [catalog, catalogSearch, catalogCategoryFilter, catalogActiveFilter]);

  const openEditCatalog = (item?: CatalogItem) => {
    if (item) {
      setEditingCatalogItem(item);
      setCatalogForm({
        itemName: item.itemName,
        itemRef: item.itemRef || '',
        category: item.category || '',
        unit: item.unit || '',
        packSize: item.packSize?.toString() || '',
        parLevel: item.parLevel?.toString() || '',
        isActive: item.active !== false,
        altNames: (item.altNames || []).join(', ')
      });
    } else {
      setEditingCatalogItem(null);
      setCatalogForm({
        itemName: '',
        itemRef: '',
        category: '',
        unit: '',
        packSize: '',
        parLevel: '',
        isActive: true,
        altNames: ''
      });
    }
    setShowCatalogModal(true);
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = {
        itemName: catalogForm.itemName,
        itemRef: catalogForm.itemRef,
        category: catalogForm.category,
        unit: catalogForm.unit,
        packSize: catalogForm.packSize ? parseInt(catalogForm.packSize) : 0,
        parLevel: catalogForm.parLevel ? parseInt(catalogForm.parLevel) : 0,
        isActive: catalogForm.isActive,
        altNames: catalogForm.altNames.split(',').map(s => s.trim()).filter(Boolean),
        updatedAt: serverTimestamp()
      };

      if (editingCatalogItem) {
        await updateDoc(doc(db, 'catalog', editingCatalogItem.id), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'catalog'), data);
      }
      
      setShowCatalogModal(false);
      setEditingCatalogItem(null);
    } catch (error) {
      console.error('Error saving catalog item:', error);
      alert('Failed to save item');
    }
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!confirm('Delete this catalog item? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'catalog', id));
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  // ===================== PRICING FUNCTIONS =====================
  const openEditPricing = (catalogId: string, price?: VendorPrice) => {
    setEditingPrice({ itemId: catalogId, price }); // itemId here is actually catalogId
    if (price) {
      setPricingForm({
        vendorId: price.vendorId,
        unitPrice: price.unitPrice?.toString() || '',
        vendorOrderNumber: price.vendorOrderNumber || '',
        vendorStatus: price.vendorStatus || 'In Stock'
      });
    } else {
      setPricingForm({
        vendorId: '',
        unitPrice: '',
        vendorOrderNumber: '',
        vendorStatus: 'In Stock'
      });
    }
    setShowPricingModal(true);
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrice) return;
    
    try {
      const data: any = {
        catalogId: editingPrice.itemId, // Save as catalogId
        vendorId: pricingForm.vendorId,
        unitPrice: pricingForm.unitPrice ? parseFloat(pricingForm.unitPrice) : 0,
        vendorOrderNumber: pricingForm.vendorOrderNumber,
        vendorStatus: pricingForm.vendorStatus,
        updatedAt: serverTimestamp()
      };

      if (editingPrice.price?.id) {
        await updateDoc(doc(db, 'vendorPricing', editingPrice.price.id), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'vendorPricing'), data);
      }
      
      setShowPricingModal(false);
      setEditingPrice(null);
    } catch (error) {
      console.error('Error saving pricing:', error);
      alert('Failed to save pricing');
    }
  };

  const handleDeletePricing = async (priceId: string) => {
    if (!confirm('Delete this vendor pricing?')) return;
    try {
      await deleteDoc(doc(db, 'vendorPricing', priceId));
      setShowPricingModal(false);
      setEditingPrice(null);
    } catch (error) {
      console.error('Error deleting pricing:', error);
      alert('Failed to delete pricing');
    }
  };

  // ===================== SETTINGS FUNCTIONS =====================
  const handleAddSettingsItem = async (collectionName: string) => {
    if (!newItemName.trim()) return;
    try {
      await addDoc(collection(db, collectionName), {
        name: newItemName.trim(),
        createdAt: serverTimestamp()
      });
      setNewItemName('');
    } catch (error) {
      console.error(`Error adding ${collectionName}:`, error);
      alert(`Failed to add ${collectionName}`);
    }
  };

  const handleDeleteSettingsItem = async (collectionName: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      console.error(`Error deleting ${collectionName}:`, error);
      alert(`Failed to delete`);
    }
  };

  const openEditVendor = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setVendorForm({
        name: vendor.name,
        phone: vendor.phone || '',
        email: vendor.email || '',
        webUrl: vendor.webUrl || '',
        accountNumber: vendor.accountNumber || '',
        serviceFee: vendor.serviceFee?.toString() || '',
        notes: vendor.notes || ''
      });
    } else {
      setEditingVendor(null);
      setVendorForm({
        name: '',
        phone: '',
        email: '',
        webUrl: '',
        accountNumber: '',
        serviceFee: '',
        notes: ''
      });
    }
    setShowVendorModal(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = {
        name: vendorForm.name,
        phone: vendorForm.phone,
        email: vendorForm.email,
        webUrl: vendorForm.webUrl,
        accountNumber: vendorForm.accountNumber,
        serviceFee: vendorForm.serviceFee ? parseFloat(vendorForm.serviceFee) : 0,
        notes: vendorForm.notes,
        updatedAt: serverTimestamp()
      };

      if (editingVendor) {
        await updateDoc(doc(db, 'vendors', editingVendor.id), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'vendors'), data);
      }
      
      setShowVendorModal(false);
      setEditingVendor(null);
    } catch (error) {
      console.error('Error saving vendor:', error);
      alert('Failed to save vendor');
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Delete this vendor? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'vendors', id));
    } catch (error) {
      console.error('Error deleting vendor:', error);
      alert('Failed to delete vendor');
    }
  };

  // ===================== RENDER =====================
  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p className="page-subtitle">Manage orders, catalog, and system settings</p>
      </div>

      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          📦 Orders
        </button>
        <button className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>
          📋 Catalog & Pricing
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings
        </button>
      </div>

      {dataLoading ? (
        <div className="content-card"><p>Loading data...</p></div>
      ) : (
        <>
          {/* ===================== ORDERS TAB ===================== */}
          {activeTab === 'orders' && (
            <div className="content-card">
              <div className="section-header">
                <h2>Order Management</h2>
                <div className="view-toggle">
                  <button className="btn btn-success" onClick={openNewRequest}>
                    + New Request
                  </button>
                  <button className={`btn ${orderView === 'item' ? 'btn-primary' : ''}`} onClick={() => setOrderView('item')}>
                    View by Item
                  </button>
                  <button className={`btn ${orderView === 'vendor' ? 'btn-primary' : ''}`} onClick={() => setOrderView('vendor')}>
                    View by Vendor
                  </button>
                </div>
              </div>

              {orderView === 'item' ? (
                <>
                  <div className="toolbar">
                    <div className="filter-buttons">
                      {/* Sections replace filter buttons */}
                    </div>
                    <div className="toolbar-right">
                      {selectedRequests.size > 0 && (
                        <button className="btn btn-primary" onClick={() => openOrderPreview()}>
                          📋 Generate Order ({selectedRequests.size})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* OPEN ORDERS SECTION */}
                  {openRequests.length > 0 && (
                    <div className="orders-section">
                      <div className="orders-section-header section-open">
                        <h3>
                          📝 Open Orders
                          <span className="count-badge">{openRequests.length}</span>
                        </h3>
                      </div>
                      <div className="orders-section-content">
                        <div className="table-container">
                          <table className="admin-table orders-table">
                            <thead>
                              <tr>
                                <th style={{ width: '30px' }}>
                                  <input
                                    type="checkbox"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRequests(new Set(openRequests.map(r => r.id)));
                                      } else {
                                        setSelectedRequests(new Set());
                                      }
                                    }}
                                  />
                                </th>
                                <th>Item / Vendor</th>
                                <th>Qty / UOI</th>
                                <th>Vendor #</th>
                                <th>Price</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {openRequests.map(r => renderOrderRow(r, ''))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ORDERED SECTION */}
                  {orderedRequests.length > 0 && (
                    <div className="orders-section">
                      <div className="orders-section-header section-ordered">
                        <h3>
                          📦 Ordered
                          <span className="count-badge">{orderedRequests.length}</span>
                        </h3>
                      </div>
                      <div className="orders-section-content">
                        <div className="table-container">
                          <table className="admin-table orders-table">
                            <thead>
                              <tr>
                                <th style={{ width: '30px' }}>
                                  <input
                                    type="checkbox"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRequests(new Set(orderedRequests.map(r => r.id)));
                                      } else {
                                        setSelectedRequests(new Set());
                                      }
                                    }}
                                  />
                                </th>
                                <th>Item / Vendor</th>
                                <th>Qty / UOI</th>
                                <th>Vendor #</th>
                                <th>Price</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderedRequests.map(r => renderOrderRow(r, 'row-ordered'))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BACKORDER SECTION */}
                  {backorderRequests.length > 0 && (
                    <div className="orders-section">
                      <div className="orders-section-header section-backordered">
                        <h3>
                          ⚠️ Backordered
                          <span className="count-badge">{backorderRequests.length}</span>
                        </h3>
                      </div>
                      <div className="orders-section-content">
                        <div className="table-container">
                          <table className="admin-table orders-table">
                            <thead>
                              <tr>
                                <th style={{ width: '30px' }}>
                                  <input
                                    type="checkbox"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRequests(new Set(backorderRequests.map(r => r.id)));
                                      } else {
                                        setSelectedRequests(new Set());
                                      }
                                    }}
                                  />
                                </th>
                                <th>Item / Vendor</th>
                                <th>Qty / UOI</th>
                                <th>Vendor #</th>
                                <th>Price</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {backorderRequests.map(r => renderOrderRow(r, 'row-backordered'))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HISTORY SECTION - Collapsible */}
                  {historyRequests.length > 0 && (
                    <div className="orders-section">
                      <div 
                        className="orders-section-header section-history clickable"
                        onClick={() => setExpandHistorySection(!expandHistorySection)}
                      >
                        <h3>
                          📋 History
                          <span className="count-badge">{historyRequests.length}</span>
                        </h3>
                        <span className="expand-icon">{expandHistorySection ? '▼' : '▶'}</span>
                      </div>
                      {expandHistorySection && (
                        <div className="orders-section-content">
                          <div className="table-container">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Item / Requester</th>
                                  <th>Qty</th>
                                  <th>Status</th>
                                  <th>Date Received</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historyRequests.map(r => (
                                  <tr key={r.id}>
                                    <td>
                                      <strong>{getItemName(r)}</strong>
                                      <br /><span className="muted">{r.requesterEmail || ''}</span>
                                    </td>
                                    <td>{r.qty || r.quantity || ''}</td>
                                    <td><span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                                    <td>{r.receivedAt && typeof r.receivedAt === 'object' && 'seconds' in r.receivedAt
                                      ? new Date(r.receivedAt.seconds * 1000).toLocaleDateString()
                                      : 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {openRequests.length === 0 && orderedRequests.length === 0 && backorderRequests.length === 0 && (
                    <div className="table-container">
                      <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No active orders found.</p>
                    </div>
                  )}
                </>
              ) : (
                // Vendor view - sectioned by status within each vendor
                <>
                  <div className="toolbar">
                    <div className="filter-buttons">
                      <label style={{ marginRight: '10px' }}>Filter by Vendor:</label>
                      <select
                        value={vendorFilter}
                        onChange={(e) => setVendorFilter(e.target.value)}
                        style={{ minWidth: '200px' }}
                      >
                        <option value="all">All Vendors</option>
                        {Array.from(requestsByVendorAndStatus.entries())
                          .sort((a, b) => a[1].vendorName.localeCompare(b[1].vendorName))
                          .map(([vendorId, group]) => {
                            const totalCount = group.open.length + group.ordered.length + group.backordered.length;
                            return (
                              <option key={vendorId} value={vendorId}>
                                {group.vendorName} ({totalCount})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <div className="toolbar-right">
                      {selectedRequests.size > 0 && (
                        <button className="btn btn-primary" onClick={() => openOrderPreview()}>
                          📋 Generate Order ({selectedRequests.size})
                        </button>
                      )}
                    </div>
                  </div>

                  {requestsByVendorAndStatus.size === 0 ? (
                    <div className="table-container">
                      <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No requests found.</p>
                    </div>
                  ) : (
                    <>
                      {/* OPEN ORDERS SECTION - Grouped by Vendor */}
                      {Array.from(requestsByVendorAndStatus.entries())
                        .filter(([vendorId, group]) => {
                          if (vendorFilter !== 'all' && vendorId !== vendorFilter) return false;
                          return group.open.length > 0;
                        })
                        .sort((a, b) => a[1].vendorName.localeCompare(b[1].vendorName))
                        .length > 0 && (
                        <div className="orders-section">
                          <div className="orders-section-header section-open">
                            <h3>📝 Open Orders</h3>
                          </div>
                          <div className="orders-section-content">
                            {Array.from(requestsByVendorAndStatus.entries())
                              .filter(([vendorId, group]) => {
                                if (vendorFilter !== 'all' && vendorId !== vendorFilter) return false;
                                return group.open.length > 0;
                              })
                              .sort((a, b) => a[1].vendorName.localeCompare(b[1].vendorName))
                              .map(([vendorId, group]) => {
                                const selectedCount = group.open.filter(r => selectedRequests.has(r.id)).length;
                                
                                return (
                                  <div key={vendorId} style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ 
                                      backgroundColor: '#f8f9fa', 
                                      padding: '0.75rem 1rem', 
                                      borderLeft: '4px solid #0066cc',
                                      marginBottom: '0.5rem',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <h4 style={{ margin: 0, color: '#0066cc', fontSize: '16px' }}>
                                        🏢 {group.vendorName}
                                        <span className="count-badge" style={{ marginLeft: '10px' }}>
                                          {group.open.length}
                                        </span>
                                      </h4>
                                      {vendorId !== 'unassigned' && vendorId !== 'unlisted' && selectedCount > 0 && (
                                        <button
                                          className="btn btn-primary btn-small"
                                          onClick={() => openOrderPreview(vendorId, group.vendorName)}
                                        >
                                          📋 Generate Order ({selectedCount})
                                        </button>
                                      )}
                                    </div>
                                    <div className="table-container">
                                      <table className="admin-table orders-table">
                                        <thead>
                                          <tr>
                                            <th style={{ width: '30px' }}>
                                              <input
                                                type="checkbox"
                                                checked={group.open.every(r => selectedRequests.has(r.id))}
                                                onChange={(e) => {
                                                  const next = new Set(selectedRequests);
                                                  group.open.forEach(r => {
                                                    if (e.target.checked) next.add(r.id);
                                                    else next.delete(r.id);
                                                  });
                                                  setSelectedRequests(next);
                                                }}
                                              />
                                            </th>
                                            <th>Item / Requester</th>
                                            <th>Qty / UOI</th>
                                            <th>Vendor #</th>
                                            <th>Price</th>
                                            <th>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.open.map(r => renderOrderRow(r, ''))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* ORDERED & BACKORDERED SECTION - Combined, Backorder first */}
                      {Array.from(requestsByVendorAndStatus.entries())
                        .filter(([vendorId, group]) => {
                          if (vendorFilter !== 'all' && vendorId !== vendorFilter) return false;
                          return group.ordered.length > 0 || group.backordered.length > 0;
                        })
                        .length > 0 && (
                        <div className="orders-section">
                          <div className="orders-section-header" style={{ borderLeft: '4px solid #ff9800' }}>
                            <h3>📦 Ordered & Backordered Items</h3>
                          </div>
                          <div className="orders-section-content">
                            {Array.from(requestsByVendorAndStatus.entries())
                              .filter(([vendorId, group]) => {
                                if (vendorFilter !== 'all' && vendorId !== vendorFilter) return false;
                                return group.ordered.length > 0 || group.backordered.length > 0;
                              })
                              .sort((a, b) => a[1].vendorName.localeCompare(b[1].vendorName))
                              .map(([vendorId, group]) => {
                                // Combine backordered (first) and ordered (second)
                                const combinedItems = [...group.backordered, ...group.ordered];
                                const selectedCount = combinedItems.filter(r => selectedRequests.has(r.id)).length;
                                
                                return (
                                  <div key={vendorId} style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ 
                                      backgroundColor: '#f8f9fa', 
                                      padding: '0.75rem 1rem', 
                                      borderLeft: '4px solid #ff9800',
                                      marginBottom: '0.5rem',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <h4 style={{ margin: 0, color: '#ff9800', fontSize: '16px' }}>
                                        🏢 {group.vendorName}
                                        <span className="count-badge" style={{ marginLeft: '10px' }}>
                                          {combinedItems.length}
                                        </span>
                                        {group.backordered.length > 0 && (
                                          <span style={{ marginLeft: '10px', fontSize: '14px', color: '#d32f2f' }}>
                                            ⚠️ {group.backordered.length} backordered
                                          </span>
                                        )}
                                      </h4>
                                      {vendorId !== 'unassigned' && vendorId !== 'unlisted' && selectedCount > 0 && (
                                        <button
                                          className="btn btn-primary btn-small"
                                          onClick={() => openOrderPreview(vendorId, group.vendorName)}
                                        >
                                          📋 Generate Order ({selectedCount})
                                        </button>
                                      )}
                                    </div>
                                    <div className="table-container">
                                      <table className="admin-table orders-table">
                                        <thead>
                                          <tr>
                                            <th style={{ width: '30px' }}>
                                              <input
                                                type="checkbox"
                                                checked={combinedItems.every(r => selectedRequests.has(r.id))}
                                                onChange={(e) => {
                                                  const next = new Set(selectedRequests);
                                                  combinedItems.forEach(r => {
                                                    if (e.target.checked) next.add(r.id);
                                                    else next.delete(r.id);
                                                  });
                                                  setSelectedRequests(next);
                                                }}
                                              />
                                            </th>
                                            <th>Item / Requester</th>
                                            <th>Qty / UOI</th>
                                            <th>Vendor #</th>
                                            <th>Price</th>
                                            <th>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {combinedItems.map(r => {
                                            const rowClass = r.status === 'Backordered' ? 'row-backordered' : 'row-ordered';
                                            return renderOrderRow(r, rowClass);
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* HISTORY SECTION - Collapsible */}
                      {(() => {
                        const allHistory = Array.from(requestsByVendorAndStatus.entries())
                          .filter(([vendorId, group]) => {
                            if (vendorFilter !== 'all' && vendorId !== vendorFilter) return false;
                            return group.history.length > 0;
                          })
                          .flatMap(([, group]) => 
                            group.history.map(r => ({ ...r, vendorName: group.vendorName }))
                          )
                          .sort((a, b) => {
                            const aDate = a.receivedAt && typeof a.receivedAt === 'object' && 'seconds' in a.receivedAt
                              ? a.receivedAt.seconds
                              : 0;
                            const bDate = b.receivedAt && typeof b.receivedAt === 'object' && 'seconds' in b.receivedAt
                              ? b.receivedAt.seconds
                              : 0;
                            return bDate - aDate; // Most recent first
                          });
                        
                        return allHistory.length > 0 && (
                          <div className="orders-section">
                            <div 
                              className="orders-section-header section-history clickable"
                              onClick={() => setExpandHistorySection(!expandHistorySection)}
                            >
                              <h3>
                                📋 History
                                <span className="count-badge">{allHistory.length}</span>
                              </h3>
                              <span className="expand-icon">{expandHistorySection ? '▼' : '▶'}</span>
                            </div>
                            {expandHistorySection && (
                              <div className="orders-section-content">
                                <div className="table-container">
                                  <table className="admin-table">
                                    <thead>
                                      <tr>
                                        <th>Item / Requester</th>
                                        <th>Vendor</th>
                                        <th>Qty</th>
                                        <th>Status</th>
                                        <th>Date Received</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {allHistory.map(r => (
                                        <tr key={r.id}>
                                          <td>
                                            <strong>{getItemName(r)}</strong>
                                            <br /><span className="muted">{r.requesterEmail || ''}</span>
                                          </td>
                                          <td>{r.vendorName}</td>
                                          <td>{r.qty || r.quantity || ''} {r.unit || ''}</td>
                                          <td><span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                                          <td>{r.receivedAt && typeof r.receivedAt === 'object' && 'seconds' in r.receivedAt
                                            ? new Date(r.receivedAt.seconds * 1000).toLocaleDateString()
                                            : 'N/A'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===================== CATALOG TAB ===================== */}
          {activeTab === 'catalog' && (
            <div className="content-card">
              <div className="section-header">
                <h2>Catalog & Vendor Pricing</h2>
                <button className="btn btn-primary" onClick={() => openEditCatalog()}>
                  + Add Item
                </button>
              </div>

              <div className="toolbar">
                <input
                  type="text"
                  placeholder="Search catalog..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  style={{ flex: 1, maxWidth: '300px' }}
                />
                <select
                  value={catalogCategoryFilter}
                  onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={catalogActiveFilter}
                  onChange={(e) => setCatalogActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
                >
                  <option value="all">All Items</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              <div className="catalog-count">
                Showing {filteredCatalog.length} of {catalog.length} items
              </div>

              <div className="table-container">
                <table className="admin-table catalog-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>PAR</th>
                      <th style={{ width: '35%' }}>Vendor Pricing</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.map(item => {
                      const categoryName = categoryMap.get(item.category || '') || item.category || 'N/A';
                      const isActive = item.active !== false;
                      const itemCatalogId = (item as any).catalogId || item.id;
                      const itemPrices = getCatalogItemPricing(item);
                      const sortedPrices = itemPrices
                        .map(p => {
                          const vendor = vendorMap.get(p.vendorId);
                          const fee = vendor?.serviceFee || 0;
                          return { ...p, vendor, effectivePrice: (p.unitPrice || 0) * (1 + fee / 100) };
                        })
                        .sort((a, b) => a.effectivePrice - b.effectivePrice);

                      return (
                        <tr key={item.id} style={{ opacity: isActive ? 1 : 0.5 }}>
                          <td>
                            <strong style={{ textDecoration: isActive ? 'none' : 'line-through' }}>
                              {item.itemName}
                            </strong>
                            {item.itemRef && <><br /><span className="muted">Ref: {item.itemRef}</span></>}
                          </td>
                          <td>{categoryName}</td>
                          <td>{item.parLevel || 0}</td>
                          <td>
                            <div className="price-tags">
                              {sortedPrices.length > 0 ? sortedPrices.map((p, idx) => (
                                <span
                                  key={p.id || idx}
                                  className={`price-tag ${idx === 0 ? 'best-price' : ''}`}
                                  onClick={() => openEditPricing(itemCatalogId, p)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {p.vendor?.name || 'Unknown'}: ${p.effectivePrice.toFixed(2)}
                                  {p.vendor?.serviceFee ? <span className="fee-note"> (+{p.vendor.serviceFee}%)</span> : ''}
                                </span>
                              )) : (
                                <span className="muted">No pricing</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <button className="btn btn-small" onClick={() => openEditCatalog(item)}>Edit</button>
                            <button className="btn btn-small btn-primary" onClick={() => openEditPricing(itemCatalogId)}>+ Price</button>
                            <button className="btn btn-small btn-danger" onClick={() => handleDeleteCatalogItem(item.id)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== SETTINGS TAB ===================== */}
          {activeTab === 'settings' && (
            <div className="content-card">
              <div className="section-header">
                <h2>System Settings</h2>
              </div>

              <div className="settings-tabs">
                <button className={`settings-tab ${settingsSection === 'vendors' ? 'active' : ''}`} onClick={() => setSettingsSection('vendors')}>
                  Vendors ({vendors.length})
                </button>
                <button className={`settings-tab ${settingsSection === 'categories' ? 'active' : ''}`} onClick={() => setSettingsSection('categories')}>
                  Categories ({categories.length})
                </button>
                <button className={`settings-tab ${settingsSection === 'compartments' ? 'active' : ''}`} onClick={() => setSettingsSection('compartments')}>
                  Compartments ({compartments.length})
                </button>
                <button className={`settings-tab ${settingsSection === 'units' ? 'active' : ''}`} onClick={() => setSettingsSection('units')}>
                  Units ({units.length})
                </button>
              </div>

              {settingsSection === 'vendors' && (
                <div className="settings-section">
                  <div className="section-header">
                    <h3>Vendor Management</h3>
                    <button className="btn btn-primary" onClick={() => openEditVendor()}>+ Add Vendor</button>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Service Fee</th>
                        <th>Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.sort((a, b) => a.name.localeCompare(b.name)).map(v => (
                        <tr key={v.id}>
                          <td><strong>{v.name}</strong></td>
                          <td>{v.email || 'N/A'}</td>
                          <td>{v.phone || 'N/A'}</td>
                          <td>{v.serviceFee ? `${v.serviceFee}%` : '—'}</td>
                          <td>{v.webUrl ? <a href={v.webUrl.startsWith('http') ? v.webUrl : `//${v.webUrl}`} target="_blank" rel="noopener noreferrer">Website</a> : '—'}</td>
                          <td>
                            <button className="btn btn-small" onClick={() => openEditVendor(v)}>Edit</button>
                            <button className="btn btn-small btn-danger" onClick={() => handleDeleteVendor(v.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {settingsSection === 'categories' && (
                <div className="settings-section">
                  <h3>Categories</h3>
                  <div className="add-item-row">
                    <input
                      type="text"
                      placeholder="New Category Name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={() => handleAddSettingsItem('categories')}>Add Category</button>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Items</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{catalog.filter(item => item.category === c.id).length}</td>
                          <td>
                            <button className="btn btn-small btn-danger" onClick={() => handleDeleteSettingsItem('categories', c.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {settingsSection === 'compartments' && (
                <div className="settings-section">
                  <h3>Compartments</h3>
                  <div className="add-item-row">
                    <input
                      type="text"
                      placeholder="New Compartment Name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={() => handleAddSettingsItem('compartments')}>Add Compartment</button>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compartments.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>
                            <button className="btn btn-small btn-danger" onClick={() => handleDeleteSettingsItem('compartments', c.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {settingsSection === 'units' && (
                <div className="settings-section">
                  <h3>Unit Types (Box, Case, Each, Kit...)</h3>
                  <div className="add-item-row">
                    <input
                      type="text"
                      placeholder="New Unit Type"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={() => handleAddSettingsItem('units')}>Add Unit</button>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.sort((a, b) => a.name.localeCompare(b.name)).map(u => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>
                            <button className="btn btn-small btn-danger" onClick={() => handleDeleteSettingsItem('units', u.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================== CATALOG MODAL ===================== */}
      {showCatalogModal && (
        <div className="modal-overlay" onClick={() => setShowCatalogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCatalogItem ? 'Edit Catalog Item' : 'Add Catalog Item'}</h3>
              <button className="close-btn" onClick={() => setShowCatalogModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveCatalogItem} className="modal-body">
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  type="text"
                  value={catalogForm.itemName}
                  onChange={(e) => setCatalogForm({ ...catalogForm, itemName: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Item Reference</label>
                  <input
                    type="text"
                    value={catalogForm.itemRef}
                    onChange={(e) => setCatalogForm({ ...catalogForm, itemRef: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={catalogForm.category}
                    onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Unit of Issue (UOI)</label>
                  <select
                    value={catalogForm.unit}
                    onChange={(e) => setCatalogForm({ ...catalogForm, unit: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="Each">Each</option>
                    <option value="Box">Box</option>
                    <option value="Case">Case</option>
                    <option value="Kit">Kit</option>
                    <option value="Brick">Brick</option>
                    <option value="Bag">Bag</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Pack">Pack</option>
                    <option value="Vial">Vial</option>
                    <option value="Tube">Tube</option>
                    <option value="Roll">Roll</option>
                    <option value="Pair">Pair</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Pack Size</label>
                  <input
                    type="number"
                    value={catalogForm.packSize}
                    onChange={(e) => setCatalogForm({ ...catalogForm, packSize: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>PAR Level</label>
                  <input
                    type="number"
                    value={catalogForm.parLevel}
                    onChange={(e) => setCatalogForm({ ...catalogForm, parLevel: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Alternate Names (comma separated)</label>
                <input
                  type="text"
                  value={catalogForm.altNames}
                  onChange={(e) => setCatalogForm({ ...catalogForm, altNames: e.target.value })}
                  placeholder="NS, Normal Saline..."
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={catalogForm.isActive}
                    onChange={(e) => setCatalogForm({ ...catalogForm, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              
              {/* Vendor Pricing Section - only show when editing existing item */}
              {editingCatalogItem && (
                <div className="form-section">
                  <h4>Vendor Pricing</h4>
                  <div className="pricing-list">
                    {(() => {
                      const itemCatalogId = (editingCatalogItem as any).catalogId || editingCatalogItem.id;
                      const itemPrices = getCatalogItemPricing(editingCatalogItem);
                      
                      if (itemPrices.length === 0) {
                        return <p className="muted">No vendor pricing configured</p>;
                      }
                      
                      return itemPrices
                        .map(p => {
                          const vendor = vendorMap.get(p.vendorId);
                          const fee = vendor?.serviceFee || 0;
                          const effectivePrice = (p.unitPrice || 0) * (1 + fee / 100);
                          return { ...p, vendor, effectivePrice };
                        })
                        .sort((a, b) => a.effectivePrice - b.effectivePrice)
                        .map((p, idx) => (
                          <div key={p.id || idx} className="pricing-list-item">
                            <div className="pricing-info">
                              <strong>{p.vendor?.name || 'Unknown Vendor'}</strong>
                              <span className="price">${p.unitPrice?.toFixed(2) || '0.00'}</span>
                              {p.vendor?.serviceFee ? (
                                <span className="fee">→ ${p.effectivePrice.toFixed(2)} after {p.vendor.serviceFee}% fee</span>
                              ) : null}
                              {p.vendorOrderNumber && <span className="order-num">Item #: {p.vendorOrderNumber}</span>}
                              <span className={`stock-status ${(p.vendorStatus || 'In Stock').replace(/\s/g, '-').toLowerCase()}`}>
                                {p.vendorStatus || 'In Stock'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-small"
                              onClick={() => openEditPricing(itemCatalogId, p)}
                            >
                              Edit
                            </button>
                          </div>
                        ));
                    })()}
                  </div>
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() => openEditPricing((editingCatalogItem as any).catalogId || editingCatalogItem.id)}
                  >
                    + Add Vendor Price
                  </button>
                </div>
              )}
              
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowCatalogModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingCatalogItem ? 'Update' : 'Add'} Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== PRICING MODAL ===================== */}
      {showPricingModal && editingPrice && (
        <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPrice.price ? 'Edit Vendor Pricing' : 'Add Vendor Pricing'}</h3>
              <button className="close-btn" onClick={() => setShowPricingModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSavePricing} className="modal-body">
              <div className="form-group">
                <label>Vendor *</label>
                <select
                  value={pricingForm.vendorId}
                  onChange={(e) => setPricingForm({ ...pricingForm, vendorId: e.target.value })}
                  required
                >
                  <option value="">Select Vendor...</option>
                  {vendors.sort((a, b) => a.name.localeCompare(b.name)).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricingForm.unitPrice}
                    onChange={(e) => setPricingForm({ ...pricingForm, unitPrice: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Vendor Item #</label>
                  <input
                    type="text"
                    value={pricingForm.vendorOrderNumber}
                    onChange={(e) => setPricingForm({ ...pricingForm, vendorOrderNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Vendor Status</label>
                <select
                  value={pricingForm.vendorStatus}
                  onChange={(e) => setPricingForm({ ...pricingForm, vendorStatus: e.target.value as any })}
                >
                  <option value="In Stock">In Stock</option>
                  <option value="Backordered">Backordered</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
              <div className="modal-footer">
                {editingPrice.price?.id && (
                  <button type="button" className="btn btn-danger" onClick={() => handleDeletePricing(editingPrice.price!.id!)}>
                    Delete
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setShowPricingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingPrice.price ? 'Update' : 'Add'} Pricing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== VENDOR MODAL ===================== */}
      {showVendorModal && (
        <div className="modal-overlay" onClick={() => setShowVendorModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button className="close-btn" onClick={() => setShowVendorModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveVendor} className="modal-body">
              <div className="form-group">
                <label>Vendor Name *</label>
                <input
                  type="text"
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Website URL</label>
                  <input
                    type="text"
                    value={vendorForm.webUrl}
                    onChange={(e) => setVendorForm({ ...vendorForm, webUrl: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Account Number</label>
                  <input
                    type="text"
                    value={vendorForm.accountNumber}
                    onChange={(e) => setVendorForm({ ...vendorForm, accountNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Service Fee (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vendorForm.serviceFee}
                  onChange={(e) => setVendorForm({ ...vendorForm, serviceFee: e.target.value })}
                  placeholder="e.g., 5 for 5%"
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={vendorForm.notes}
                  onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingVendor ? 'Update' : 'Add'} Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== NEW REQUEST MODAL ===================== */}
      {showNewRequestModal && (
        <div className="modal-overlay" onClick={() => setShowNewRequestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Request</h3>
              <button className="close-btn" onClick={() => setShowNewRequestModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateRequest} className="modal-body">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newRequestForm.isOtherItem}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, isOtherItem: e.target.checked })}
                  />
                  Request unlisted/custom item
                </label>
              </div>
              
              {newRequestForm.isOtherItem ? (
                <div className="form-group">
                  <label>Item Description *</label>
                  <input
                    type="text"
                    value={newRequestForm.otherItemName}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, otherItemName: e.target.value })}
                    placeholder="Describe the item you need"
                    required
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Select Item *</label>
                  <select
                    value={newRequestForm.catalogId}
                    onChange={(e) => {
                      const selectedItem = catalog.find(c => (c as any).catalogId === e.target.value);
                      setNewRequestForm({
                        ...newRequestForm,
                        catalogId: e.target.value,
                        unit: selectedItem?.unit || newRequestForm.unit
                      });
                    }}
                    required
                  >
                    <option value="">Select an item...</option>
                    {catalog
                      .filter(c => c.active !== false)
                      .sort((a, b) => a.itemName.localeCompare(b.itemName))
                      .map(c => (
                        <option key={c.id} value={(c as any).catalogId || c.id}>
                          {c.itemName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="text"
                    value={newRequestForm.qty}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, qty: e.target.value })}
                    placeholder="e.g., 2"
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    value={newRequestForm.unit}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, unit: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {units.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newRequestForm.notes}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Optional notes for this request"
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowNewRequestModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== ORDER PREVIEW MODAL ===================== */}
      {showOrderPreview && orderPreviewData && (
        <div className="modal-overlay" onClick={() => setShowOrderPreview(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Order Preview - {orderPreviewData.vendorName}</h3>
              <button className="close-btn" onClick={() => setShowOrderPreview(false)}>&times;</button>
            </div>
            <div className="modal-body order-preview-body">
              <div className="order-preview-info">
                <p><strong>Vendor:</strong> {orderPreviewData.vendorName}</p>
                {vendorMap.get(orderPreviewData.vendorId)?.accountNumber && (
                  <p><strong>Account #:</strong> {vendorMap.get(orderPreviewData.vendorId)?.accountNumber}</p>
                )}
                {vendorMap.get(orderPreviewData.vendorId)?.email && (
                  <p><strong>Email:</strong> {vendorMap.get(orderPreviewData.vendorId)?.email}</p>
                )}
                {vendorMap.get(orderPreviewData.vendorId)?.phone && (
                  <p><strong>Phone:</strong> {vendorMap.get(orderPreviewData.vendorId)?.phone}</p>
                )}
                <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              </div>
              
              <table className="admin-table order-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Vendor Item #</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderPreviewData.items.map((item, idx) => {
                    const qty = parseFloat(item.qty || item.quantity || '1') || 1;
                    const lineTotal = qty * (item.unitPrice || 0);
                    return (
                      <tr key={item.id}>
                        <td>{idx + 1}</td>
                        <td>{item.itemName}</td>
                        <td>{item.qty || item.quantity || '1'}</td>
                        <td>{item.unit || ''}</td>
                        <td>{item.vendorOrderNumber || 'N/A'}</td>
                        <td>{item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : '—'}</td>
                        <td>{item.unitPrice ? `$${lineTotal.toFixed(2)}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const subtotal = orderPreviewData.items.reduce((sum, item) => {
                      const qty = parseFloat(item.qty || item.quantity || '1') || 1;
                      return sum + (qty * (item.unitPrice || 0));
                    }, 0);
                    const vendor = vendorMap.get(orderPreviewData.vendorId);
                    const fee = vendor?.serviceFee ? subtotal * (vendor.serviceFee / 100) : 0;
                    
                    return (
                      <>
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'right' }}><strong>Subtotal:</strong></td>
                          <td><strong>${subtotal.toFixed(2)}</strong></td>
                        </tr>
                        {vendor?.serviceFee && (
                          <>
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'right' }}>Service Fee ({vendor.serviceFee}%):</td>
                              <td>${fee.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'right' }}><strong>Total:</strong></td>
                              <td><strong>${(subtotal + fee).toFixed(2)}</strong></td>
                            </tr>
                          </>
                        )}
                      </>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
            <div className="modal-footer order-preview-footer">
              <div className="order-actions-left">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                  <input 
                    type="checkbox" 
                    checked={includePricing} 
                    onChange={(e) => setIncludePricing(e.target.checked)}
                  />
                  <span>Include Pricing</span>
                </label>
                <button className="btn btn-success" onClick={handleMarkOrdered}>
                  ✓ Mark as Ordered
                </button>
              </div>
              <div className="order-actions-right">
                <button className="btn" onClick={handlePrintOrder}>
                  🖨️ Print
                </button>
                <button className="btn btn-primary" onClick={handleEmailOrder}>
                  ✉️ Email
                </button>
                <button className="btn" onClick={() => setShowOrderPreview(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
