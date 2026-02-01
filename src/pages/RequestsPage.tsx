import { useState, useMemo } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useInventoryData } from '../hooks/useInventoryData';
import './CommonPages.css';
import './RequestsPage.css';

type StatusFilter = 'All' | 'Open' | 'Ordered' | 'Backordered' | 'Received' | 'Cancelled';

export const RequestsPage = () => {
  const { catalog, requests, vendors, pricing, loading } = useInventoryData();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [showHistory, setShowHistory] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isUnlistedItem, setIsUnlistedItem] = useState(false);
  const [unlistedItemName, setUnlistedItemName] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemSearchFocused, setItemSearchFocused] = useState(false);
  const [historyDays, setHistoryDays] = useState(30);
  const [historySearch, setHistorySearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  // Create a map for fast catalog lookups
  const catalogMap = useMemo(() => {
    return new Map(catalog.map(item => [item.id, item]));
  }, [catalog]);

  const catalogByCatalogId = useMemo(() => {
    return new Map(catalog.map(item => [(item as any).catalogId, item]));
  }, [catalog]);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    let filtered = requests.filter(request => {
      const itemName = getItemName(request).toLowerCase();
      const searchTerm = (itemSearchTerm || '').toLowerCase();
      const matchesSearch = !searchTerm || itemName.includes(searchTerm);
        
      const matchesStatus = statusFilter === 'All' || request.status === statusFilter;
      const matchesUnit = selectedUnit === 'all' || request.unit === selectedUnit;
      
      return matchesSearch && matchesStatus && matchesUnit;
    });

    // Sort by status priority, then by item name
    const statusPriority = {
      'Open': 1,
      'Backordered': 2, 
      'Back ordered': 2, // Handle both spellings
      'Ordered': 3,
      'Received': 4,
      'Cancelled': 5
    };

    return filtered.sort((a, b) => {
      // First sort by status priority
      const statusA = statusPriority[a.status] || 999;
      const statusB = statusPriority[b.status] || 999;
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Then sort by item name
      const nameA = getItemName(a).toLowerCase();
      const nameB = getItemName(b).toLowerCase();
      
      return nameA.localeCompare(nameB);
    });
  }, [requests, itemSearchTerm, statusFilter, selectedUnit, catalog]);

  const historyItems = useMemo(() => {
    const historyStatuses = ['Received', 'Cancelled', 'Completed', 'Closed'];
    let filtered = requests.filter(r => r.status && historyStatuses.includes(r.status));
    
    // Apply history day filter
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyDays);
    filtered = filtered.filter(r => {
      const timestamp = r.updatedAt && typeof r.updatedAt === 'object' && 'seconds' in r.updatedAt
        ? new Date(r.updatedAt.seconds * 1000)
        : r.createdAt && typeof r.createdAt === 'object' && 'seconds' in r.createdAt
        ? new Date(r.createdAt.seconds * 1000)
        : null;
      return timestamp && timestamp >= cutoff;
    });
    
    // Apply history search
    if (historySearch) {
      filtered = filtered.filter(r => {
        const itemName = getItemName(r).toLowerCase();
        const noteText = (r.notes || '').toLowerCase();
        const search = historySearch.toLowerCase();
        return itemName.includes(search) || noteText.includes(search);
      });
    }

    // Sort by update date (newest first)
    filtered.sort((a, b) => {
      const aTime = a.updatedAt && typeof a.updatedAt === 'object' && 'seconds' in a.updatedAt 
        ? a.updatedAt.seconds 
        : 0;
      const bTime = b.updatedAt && typeof b.updatedAt === 'object' && 'seconds' in b.updatedAt 
        ? b.updatedAt.seconds 
        : 0;
      return bTime - aTime;
    });

    return filtered.slice(0, 50);
  }, [requests, historyDays, historySearch]);

  const getItemName = (request: any) => {
    // Check for unlisted/other items first
    if (request.otherItemName) {
      return request.otherItemName;
    }
    // Check for catalog items by catalogId field
    if (request.catalogId) {
      const item = catalog.find(c => (c as any).catalogId === request.catalogId);
      return item?.itemName || 'Unknown Item';
    }
    // Also support legacy itemId field
    if (request.itemId) {
      const item = catalogMap.get(request.itemId);
      return item?.itemName || 'Unknown Item';
    }
    // Fallback
    return 'Unknown Item';
  };

  const getItemAltNames = (request: any) => {
    // Check for catalog items by catalogId field
    if (request.catalogId) {
      const item = catalog.find(c => (c as any).catalogId === request.catalogId);
      return item?.altNames || [];
    }
    // Also support legacy itemId field
    if (request.itemId) {
      const item = catalogMap.get(request.itemId);
      return item?.altNames || [];
    }
    return [];
  };

  const getItemPricing = (catalogId?: string, itemId?: string) => {
    if (!catalogId && !itemId) return [];

    const catalogItem = catalogId ? catalogByCatalogId.get(catalogId) : undefined;
    const targetItemId = itemId || catalogItem?.id;
    const targetCatalogId = catalogId || (catalogItem as any)?.catalogId;

    return pricing
      .filter(p => (targetItemId && p.itemId === targetItemId) || (targetCatalogId && p.catalogId === targetCatalogId))
      .sort((a, b) => (a.unitPrice || Infinity) - (b.unitPrice || Infinity));
  };

  // Helper to generate search variations for terms like "3ml" -> ["3ml", "3 ml"]
  const getSearchVariations = (term: string): string[] => {
    const variations = [term];
    // Check if term is like "3ml", "20g", etc. (number followed by letters)
    const numberLetterPattern = /^(\d+)([a-z]+)$/i;
    const match = term.match(numberLetterPattern);
    if (match) {
      // Add version with space: "3ml" -> "3 ml"
      variations.push(`${match[1]} ${match[2]}`);
    }
    // Check if term is like "3 ml" (number space letters)
    const spacedPattern = /^(\d+)\s+([a-z]+)$/i;
    const spacedMatch = term.match(spacedPattern);
    if (spacedMatch) {
      // Add version without space: "3 ml" -> "3ml"
      variations.push(`${spacedMatch[1]}${spacedMatch[2]}`);
    }
    return variations;
  };

  const getVendorName = (vendorId?: string) => {
    if (!vendorId) return 'Not Assigned';
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name || 'Unknown Vendor';
  };

  const handleMarkReceived = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'Received',
        receivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking as received:', error);
      alert('Failed to mark as received');
    }
  };

  const handleSaveNote = async (requestId: string, newNote: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        notes: newNote,
        updatedAt: serverTimestamp()
      });
      setEditingNoteId(null);
      setEditNoteValue('');
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note');
    }
  };

  const handleSaveQty = async (requestId: string, newQty: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        quantity: newQty,
        qty: newQty,
        updatedAt: serverTimestamp()
      });
      setEditingQtyId(null);
      setEditQtyValue('');
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity');
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isUnlistedItem) {
      if (!unlistedItemName.trim()) {
        alert('Please enter the item name');
        return;
      }
    } else {
      if (!selectedItemId) {
        alert('Please select an item');
        return;
      }
    }

    try {
      const requestData: any = {
        quantity: quantity.trim() || '',
        notes: notes.trim() || '',
        status: 'Open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (isUnlistedItem) {
        requestData.otherItemName = unlistedItemName.trim();
      } else {
        // Store the catalogId from the selected catalog item
        const selectedItem = catalogMap.get(selectedItemId);
        if (selectedItem && (selectedItem as any).catalogId) {
          requestData.catalogId = (selectedItem as any).catalogId;
        } else {
          // Fallback to itemId if no catalogId exists
          requestData.itemId = selectedItemId;
        }
      }

      await addDoc(collection(db, 'requests'), requestData);
      
      // Reset form
      setSelectedItemId('');
      setQuantity('');
      setNotes('');
      setIsUnlistedItem(false);
      setUnlistedItemName('');
      setItemSearchTerm('');
      setShowNewRequestModal(false);
      alert('Request submitted successfully!');
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Failed to create request');
    }
  };

  const formatDate = (date: Date | { seconds: number; nanoseconds: number } | undefined) => {
    if (!date) return 'N/A';
    const timestamp = typeof date === 'object' && 'seconds' in date 
      ? new Date(date.seconds * 1000)
      : date;
    return timestamp.toLocaleDateString();
  };

  const stats = useMemo(() => {
    const openCount = requests.filter(r => r.status === 'Open').length;
    const orderedCount = requests.filter(r => r.status === 'Ordered').length;
    const backorderedCount = requests.filter(r => r.status === 'Backordered').length;
    return { openCount, orderedCount, backorderedCount };
  }, [requests]);

  if (loading) {
    return (
      <div className="page-container">
        <p>Loading requests...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Supply Requests</h1>
        <p className="page-subtitle">View and manage supply order requests</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.openCount}</span>
          <span className="stat-label">Open Requests</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.orderedCount}</span>
          <span className="stat-label">Ordered</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.backorderedCount}</span>
          <span className="stat-label">Backordered</span>
        </div>
      </div>

      <div className="controls-section">
        <div className="filter-buttons">
          {(['All', 'Open', 'Ordered', 'Backordered'] as StatusFilter[]).map(status => (
            <button
              key={status}
              className={`filter-btn ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowNewRequestModal(true)}
        >
          + New Request
        </button>
      </div>

      <div className="content-card">
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Pending Requests</h3>
        {filteredRequests.length === 0 ? (
          <p className="muted">No active requests found.</p>
        ) : (
          <div className="table-container">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Item / Vendor Pricing</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(request => {
                  const itemName = getItemName(request);
                  const altNames = getItemAltNames(request);
                  const statusLabel = request.status || 'Open';
                  const statusClass = String(statusLabel).toLowerCase().replace(/\s+/g, '-');
                  const vendorPrices = getItemPricing(request.catalogId, request.itemId);
                  const isEditingNote = editingNoteId === request.id;
                  const isEditingQty = editingQtyId === request.id;

                  return (
                    <tr key={request.id}>
                      <td>
                        <details>
                          <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
                            <div className="item-name-cell" style={{ display: 'inline-block' }}>
                              <span>{itemName}</span>
                              {altNames.length > 0 && (
                                <span className="alt-names-small">({altNames.join(', ')})</span>
                              )}
                            </div>
                          </summary>
                          {vendorPrices.length > 0 ? (
                            <table className="vendor-pricing-table">
                              <thead>
                                <tr>
                                  <th>Vendor</th>
                                  <th>Price</th>
                                  <th>Item #</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vendorPrices.map((vp, idx) => (
                                  <tr key={idx}>
                                    <td>{getVendorName(vp.vendorId)}</td>
                                    <td>{vp.unitPrice ? `$${vp.unitPrice.toFixed(2)}` : 'N/A'}</td>
                                    <td>{vp.vendorOrderNumber || 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="muted" style={{ fontSize: '0.85rem', margin: '0.5rem 0' }}>
                              No pricing info available
                            </p>
                          )}
                        </details>
                      </td>
                      <td>
                        {isEditingQty ? (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editQtyValue}
                              onChange={(e) => setEditQtyValue(e.target.value)}
                              style={{ flex: 1, minWidth: '80px' }}
                            />
                            <button
                              className="btn btn-small"
                              onClick={() => handleSaveQty(request.id, editQtyValue)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => {
                                setEditingQtyId(null);
                                setEditQtyValue('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              setEditingQtyId(request.id);
                              setEditQtyValue(request.quantity || request.qty || '');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {request.quantity || request.qty || ''}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge status-${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        {isEditingNote ? (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editNoteValue}
                              onChange={(e) => setEditNoteValue(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button
                              className="btn btn-small"
                              onClick={() => handleSaveNote(request.id, editNoteValue)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditNoteValue('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              setEditingNoteId(request.id);
                              setEditNoteValue(request.notes || '');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {request.notes || 'Click to add note'}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-receive"
                          onClick={() => handleMarkReceived(request.id)}
                        >
                          Mark Received
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="content-card" style={{ marginTop: '1rem' }}>
        <details open={showHistory} onToggle={(e) => setShowHistory((e.target as HTMLDetailsElement).open)}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', padding: '0.5rem 0' }}>
            View Order History
          </summary>
          <div style={{ marginTop: '1rem' }}>
            <div className="toolbar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button
                className={`filter-btn ${historyDays === 30 ? 'active' : ''}`}
                onClick={() => setHistoryDays(30)}
              >
                Last 30 Days
              </button>
              <button
                className={`filter-btn ${historyDays === 60 ? 'active' : ''}`}
                onClick={() => setHistoryDays(60)}
              >
                Last 60 Days
              </button>
              <button
                className={`filter-btn ${historyDays === 90 ? 'active' : ''}`}
                onClick={() => setHistoryDays(90)}
              >
                Last 90 Days
              </button>
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
            </div>
            {historyItems.length === 0 ? (
              <p className="muted">No history in the last {historyDays} days.</p>
            ) : (
              <div className="table-container">
                <table className="requests-table history-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Received/Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map(request => {
                      const itemName = getItemName(request);
                      const altNames = getItemAltNames(request);
                      const statusLabel = request.status || 'Unknown';
                      const statusClass = String(statusLabel).toLowerCase().replace(/\s+/g, '-');

                      return (
                        <tr key={request.id}>
                          <td>
                            <div className="item-name-cell">
                              <span>{itemName}</span>
                              {altNames.length > 0 && (
                                <span className="alt-names-small">({altNames.join(', ')})</span>
                              )}
                            </div>
                          </td>
                          <td>{request.quantity || request.qty || ''}</td>
                          <td>
                            <span className={`status-badge status-${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td>{request.notes || ''}</td>
                          <td>{formatDate(request.updatedAt || request.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="modal-overlay" onClick={() => setShowNewRequestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Supply Request</h3>
              <button className="close-btn" onClick={() => setShowNewRequestModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleCreateRequest} className="modal-body">
              <div className="form-group">
                <div className="form-row space-between">
                  <label>Item from Catalog</label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isUnlistedItem}
                      onChange={(e) => {
                        setIsUnlistedItem(e.target.checked);
                        setSelectedItemId('');
                        setItemSearchTerm('');
                        setUnlistedItemName('');
                      }}
                    />
                    Or, request an item not in the list
                  </label>
                </div>

                {isUnlistedItem ? (
                  <input
                    type="text"
                    placeholder="Enter unlisted item name..."
                    value={unlistedItemName}
                    onChange={(e) => setUnlistedItemName(e.target.value)}
                  />
                ) : (
                  <div className="searchable-select">
                    <input
                      type="text"
                      placeholder="Search for an item..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      onFocus={() => setItemSearchFocused(true)}
                      onBlur={() => setTimeout(() => setItemSearchFocused(false), 200)}
                      className="search-input"
                    />
                    {(itemSearchFocused || itemSearchTerm) && (
                      <div className="select-list">
                        {catalog
                          .filter(item => item.active !== false)
                          .filter(item => {
                            if (!itemSearchTerm) return true;
                            const searchTerms = itemSearchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
                            const itemNameLower = item.itemName.toLowerCase();
                            const altNamesLower = (item.altNames || []).map(alt => alt.toLowerCase());
                            
                            return searchTerms.every(term => {
                              // Get all variations of the search term (e.g., "3ml" and "3 ml")
                              const variations = getSearchVariations(term);
                              
                              // Check if any variation matches in item name
                              const matchesName = variations.some(variation => itemNameLower.includes(variation));
                              if (matchesName) return true;
                              
                              // Check if any variation matches in alt names
                              return altNamesLower.some(altName => 
                                variations.some(variation => altName.includes(variation))
                              );
                            });
                          })
                          .sort((a, b) => a.itemName.localeCompare(b.itemName))
                          .map(item => (
                            <div
                              key={item.id}
                              className={`select-item ${selectedItemId === item.id ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedItemId(item.id);
                                setItemSearchTerm(item.itemName);
                                setItemSearchFocused(false);
                              }}
                            >
                              {item.itemName}
                              {item.altNames && item.altNames.length > 0 && (
                                <span className="alt-names"> ({item.altNames.join(', ')})</span>
                              )}
                            </div>
                          ))}
                        {catalog.filter(item => item.active !== false).filter(item => {
                          if (!itemSearchTerm) return true;
                          const searchTerms = itemSearchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
                          const itemNameLower = item.itemName.toLowerCase();
                          const altNamesLower = (item.altNames || []).map(alt => alt.toLowerCase());
                          return searchTerms.every(term => {
                            const variations = getSearchVariations(term);
                            const matchesName = variations.some(variation => itemNameLower.includes(variation));
                            if (matchesName) return true;
                            return altNamesLower.some(altName => 
                              variations.some(variation => altName.includes(variation))
                            );
                          });
                        }).length === 0 && (
                          <div className="select-item-empty">No items found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Quantity (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., 1 Box or 5 EA"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., For Unit 31"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-cancel" onClick={() => setShowNewRequestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
