import { useState, useMemo, useCallback } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp, where, orderBy, limit, type QueryConstraint } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useInventoryData } from '../hooks/useInventoryData';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import type { OrderRequest } from '../types';
import { getItemName, getSearchVariations, parseFirebaseDate } from '../utils/helpers';
import './CommonPages.css';
import './RequestsPage.css';

type StatusFilter = 'Active' | 'Open' | 'Ordered' | 'Backordered' | 'Received' | 'Cancelled';
type HistoryWindow = 30 | 60 | 90 | 180 | 'ALL';

const ACTIVE_REQUEST_STATUSES = ['Open', 'Ordered', 'Backordered', 'Back ordered'];
const HISTORY_REQUEST_STATUSES = ['Received', 'Cancelled'];
const HISTORY_DEFAULT_DAYS = 180;
const ARCHIVE_FETCH_LIMIT = 1200;

export const RequestsPage = () => {
  const historyCutoffDate = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - HISTORY_DEFAULT_DAYS);
    return cutoff;
  }, []);

  const activeRequestConstraints = useMemo<QueryConstraint[]>(() => [
    where('status', 'in', ACTIVE_REQUEST_STATUSES),
    orderBy('updatedAt', 'desc')
  ], []);

  const historyRequestConstraints = useMemo<QueryConstraint[]>(() => [
    where('status', 'in', HISTORY_REQUEST_STATUSES),
    where('updatedAt', '>=', historyCutoffDate),
    orderBy('updatedAt', 'desc'),
    limit(300)
  ], [historyCutoffDate]);

  const archiveRequestConstraints = useMemo<QueryConstraint[]>(() => [
    where('status', 'in', HISTORY_REQUEST_STATUSES),
    where('updatedAt', '<', historyCutoffDate),
    orderBy('updatedAt', 'desc'),
    limit(ARCHIVE_FETCH_LIMIT)
  ], [historyCutoffDate]);

  const { catalog, requests, vendors, pricing, loading: activeLoading } = useInventoryData({
    requestConstraints: activeRequestConstraints
  });
  const { data: historyRequests, loading: historyLoading } = useFirestoreCollection<OrderRequest>('requests', historyRequestConstraints);
  const [loadArchive, setLoadArchive] = useState(false);
  const { data: archiveRequests, loading: archiveLoading } = useFirestoreCollection<OrderRequest>('requests', archiveRequestConstraints, loadArchive);
  const loading = activeLoading || historyLoading || archiveLoading;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [showHistory, setShowHistory] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [requestUnit, setRequestUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [isUnlistedItem, setIsUnlistedItem] = useState(false);
  const [unlistedItemName, setUnlistedItemName] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemSearchFocused, setItemSearchFocused] = useState(false);
  const [historyDays, setHistoryDays] = useState<HistoryWindow>(HISTORY_DEFAULT_DAYS);
  const [historySearch, setHistorySearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState('');
  const [selectedUnit] = useState<string>('all');
  const [mainSearchTerm, setMainSearchTerm] = useState('');
  const [duplicateRequestChoice, setDuplicateRequestChoice] = useState<{
    existingRequest: any;
    closeModal: boolean;
  } | null>(null);

  // Create a map for fast catalog lookups
  const catalogMap = useMemo(() => {
    return new Map(catalog.map(item => [item.id, item]));
  }, [catalog]);

  const catalogByCatalogId = useMemo(() => {
    const map = new Map<string, any>();
    catalog.forEach(item => {
      const catId = (item as any).catalogId;
      if (catId) map.set(catId, item);
      // Also map by item.id for newly created items that don't have catalogId field
      map.set(item.id, item);
    });
    return map;
  }, [catalog]);

  const resolveItemName = useCallback(
    (request: any) => getItemName(request, catalogByCatalogId, catalogMap),
    [catalogByCatalogId, catalogMap]
  );

  const duplicateRequestCandidate = useMemo(() => {
    if (isUnlistedItem) {
      const targetName = unlistedItemName.trim().toLowerCase();
      if (!targetName) return null;

      return requests.find(request => {
        const normalizedStatus = request.status || 'Open';
        return ACTIVE_REQUEST_STATUSES.includes(normalizedStatus)
          && !!request.otherItemName
          && request.otherItemName.trim().toLowerCase() === targetName;
      }) || null;
    }

    if (!selectedItemId) return null;

    const selectedItem = catalogMap.get(selectedItemId);
    const selectedCatalogId = (selectedItem as any)?.catalogId;

    return requests.find(request => {
      const normalizedStatus = request.status || 'Open';
      if (!ACTIVE_REQUEST_STATUSES.includes(normalizedStatus)) return false;
      const requestKey = request.catalogId || request.itemId;
      return requestKey === selectedCatalogId || requestKey === selectedItemId;
    }) || null;
  }, [isUnlistedItem, unlistedItemName, selectedItemId, requests, catalogMap]);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];

    const filtered = requests.filter(request => {
      const itemName = resolveItemName(request).toLowerCase();
      const searchTerm = (mainSearchTerm || '').toLowerCase();
      
      // Get catalog item for itemRef search
      let itemRef = '';
      if (request.catalogId) {
        const catalogItem = catalogByCatalogId.get(request.catalogId) || 
                           catalog.find(c => (c as any).catalogId === request.catalogId || c.id === request.catalogId);
        itemRef = (catalogItem?.itemRef || '').toLowerCase();
      } else if (request.itemId) {
        const catalogItem = catalogMap.get(request.itemId);
        itemRef = (catalogItem?.itemRef || '').toLowerCase();
      }
      
      const matchesSearch = !searchTerm || itemName.includes(searchTerm) || itemRef.includes(searchTerm);
      const normalizedStatus = request.status || 'Open';
      const matchesStatus = statusFilter === 'Active'
        ? ACTIVE_REQUEST_STATUSES.includes(normalizedStatus)
        : normalizedStatus === statusFilter;

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
      const statusA = (a.status && statusPriority[a.status as keyof typeof statusPriority]) || 999;
      const statusB = (b.status && statusPriority[b.status as keyof typeof statusPriority]) || 999;
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Then sort by item name
      const nameA = resolveItemName(a).toLowerCase();
      const nameB = resolveItemName(b).toLowerCase();
      
      return nameA.localeCompare(nameB);
    });
  }, [requests, mainSearchTerm, statusFilter, selectedUnit, catalog, catalogByCatalogId, catalogMap, resolveItemName]);

  const historyItems = useMemo(() => {
    const mergedHistory = loadArchive
      ? Array.from(new Map([...historyRequests, ...archiveRequests].map(item => [item.id, item])).values())
      : historyRequests;

    let filtered = mergedHistory.filter(r => r.status && HISTORY_REQUEST_STATUSES.includes(r.status));
    
    // Apply history day filter
    if (historyDays !== 'ALL') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - historyDays);
      filtered = filtered.filter(r => {
        const timestamp = parseFirebaseDate(r.updatedAt) || parseFirebaseDate(r.createdAt);
        return timestamp && timestamp >= cutoff;
      });
    }
    
    // Apply history search
    if (historySearch) {
      filtered = filtered.filter(r => {
        const itemName = resolveItemName(r).toLowerCase();
        const noteText = (r.notes || '').toLowerCase();
        const search = historySearch.toLowerCase();
        return itemName.includes(search) || noteText.includes(search);
      });
    }

    // Sort by update date (newest first)
    filtered.sort((a, b) => {
      const aTime = parseFirebaseDate(a.updatedAt)?.getTime() || 0;
      const bTime = parseFirebaseDate(b.updatedAt)?.getTime() || 0;
      return bTime - aTime;
    });

    return loadArchive ? filtered : filtered.slice(0, 50);
  }, [historyRequests, archiveRequests, loadArchive, historyDays, historySearch, resolveItemName]);

  function getItemAltNames(request: any) {
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
  }

  function getItemPricing(catalogId?: string, itemId?: string) {
    if (!catalogId && !itemId) return [];

    const catalogItem = catalogId ? catalogByCatalogId.get(catalogId) : undefined;
    const targetItemId = itemId || catalogItem?.id;
    const targetCatalogId = catalogId || (catalogItem as any)?.catalogId;

    return pricing
      .filter(p => (targetItemId && p.itemId === targetItemId) || (targetCatalogId && p.catalogId === targetCatalogId))
      .map(p => {
        const normalizedUnitPrice = typeof p.unitPrice === 'number' ? p.unitPrice : Number(p.unitPrice);
        return {
          ...p,
          unitPrice: Number.isFinite(normalizedUnitPrice) ? normalizedUnitPrice : undefined
        };
      })
      .sort((a, b) => (a.unitPrice || Infinity) - (b.unitPrice || Infinity));
  }

  function getVendorName(vendorId?: string) {
    if (!vendorId) return 'Not Assigned';
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name || 'Unknown Vendor';
  }

  const handleMarkReceived = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'Received',
        receivedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking as received:', error);
      alert('Failed to mark as received');
    }
  };

  const handleSaveNote = async (requestId: string, newNote: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        notes: newNote
      });
      setEditingNoteId(null);
      setEditNoteValue('');
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note');
    }
  };

  const handleSaveQty = async (requestId: string, newQty: string) => {
    const parsedQuantity = Number(newQty);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      alert('Please enter a valid number for quantity');
      return;
    }

    try {
      await updateDoc(doc(db, 'requests', requestId), {
        quantity: parsedQuantity,
        updatedAt: serverTimestamp()
      });
      setEditingQtyId(null);
      setEditQtyValue('');
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity');
    }
  };

  const getRequestQuantity = (request: any) => Number(request.quantity ?? (request as any).qty ?? 0) || 0;

  const combineQuantities = (
    existingQty: number,
    existingUnit: string | undefined,
    additionalQty: number,
    additionalUnit: string | undefined
  ): { quantity: number; unit: string } | null => {
    const current = Number(existingQty) || 0;
    const incoming = Number(additionalQty);

    if (!Number.isFinite(incoming) || incoming <= 0) {
      return null;
    }

    const normalizedExistingUnit = (existingUnit || '').trim().toLowerCase();
    const normalizedIncomingUnit = (additionalUnit || '').trim().toLowerCase();

    if (normalizedExistingUnit && normalizedIncomingUnit && normalizedExistingUnit !== normalizedIncomingUnit) {
      return null;
    }

    return {
      quantity: current + incoming,
      unit: (existingUnit || additionalUnit || '').trim()
    };
  };

  const resetNewRequestForm = () => {
    setSelectedItemId('');
    setQuantity('');
    setRequestUnit('');
    setNotes('');
    setIsUnlistedItem(false);
    setUnlistedItemName('');
    setItemSearchTerm('');
    setItemSearchFocused(false);
  };

  const handleIncreaseExistingRequest = async () => {
    if (!duplicateRequestChoice) return;
    if (!quantity.trim()) {
      alert('Enter a quantity to add, or choose Add Separate Request.');
      return;
    }

    const { existingRequest, closeModal } = duplicateRequestChoice;

    try {
      const additionalQuantity = Number(quantity.trim());
      if (!Number.isFinite(additionalQuantity) || additionalQuantity <= 0) {
        alert('Enter a valid numeric quantity greater than zero.');
        return;
      }

      const merged = combineQuantities(
        getRequestQuantity(existingRequest),
        existingRequest.unit,
        additionalQuantity,
        requestUnit
      );

      if (!merged) {
        alert('Cannot merge quantities because the units do not match.');
        return;
      }

      const updatedNotes = [existingRequest.notes?.trim(), notes.trim()].filter(Boolean).join(' | ');

      await updateDoc(doc(db, 'requests', existingRequest.id), {
        quantity: merged.quantity,
        unit: merged.unit,
        notes: updatedNotes,
        updatedAt: serverTimestamp()
      });

      setDuplicateRequestChoice(null);
      resetNewRequestForm();

      if (closeModal) {
        setShowNewRequestModal(false);
      }

      alert('Existing request quantity updated.');
    } catch (error) {
      console.error('Error updating existing request quantity:', error);
      alert('Failed to update the existing request');
    }
  };

  const handleCreateRequest = async (closeModal: boolean = true, skipDuplicateCheck: boolean = false) => {
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

    if (!skipDuplicateCheck && duplicateRequestCandidate) {
      setDuplicateRequestChoice({
        existingRequest: duplicateRequestCandidate,
        closeModal
      });
      return;
    }

    try {
      const numericQuantity = Number(quantity.trim() || 0);
      if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
        alert('Please enter a valid numeric quantity.');
        return;
      }

      const requestData: any = {
        quantity: numericQuantity,
        unit: requestUnit.trim(),
        notes: notes.trim() || '',
        status: 'Open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (isUnlistedItem) {
        requestData.otherItemName = unlistedItemName.trim();
      } else {
        const selectedItem = catalogMap.get(selectedItemId);
        requestData.catalogId = (selectedItem as any)?.catalogId || selectedItemId;
      }

      await addDoc(collection(db, 'requests'), requestData);

      setDuplicateRequestChoice(null);
      resetNewRequestForm();

      if (closeModal) {
        setShowNewRequestModal(false);
      }

      alert('Request submitted successfully!');
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Failed to create request');
    }
  };

  const formatDate = (date: Date | { seconds: number; nanoseconds: number } | undefined) => {
    if (!date) return 'N/A';
    const timestamp = parseFirebaseDate(date);
    return timestamp ? timestamp.toLocaleDateString() : 'N/A';
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
          {(['Active', 'Open', 'Ordered', 'Backordered'] as StatusFilter[]).map(status => (
            <button
              key={status}
              className={`filter-btn ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search items..."
            value={mainSearchTerm}
            onChange={(e) => setMainSearchTerm(e.target.value)}
            className="search-input"
            style={{ width: '300px' }}
          />
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
                  const itemName = resolveItemName(request);
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
                                  <th>Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vendorPrices.map((vp, idx) => {
                                  const unitPriceNumber = Number(vp.unitPrice);
                                  const formattedPrice = Number.isFinite(unitPriceNumber)
                                    ? `$${unitPriceNumber.toFixed(2)}`
                                    : 'N/A';

                                  return (
                                    <tr key={idx}>
                                      <td>{getVendorName(vp.vendorId)}</td>
                                      <td>{formattedPrice}</td>
                                      <td>{vp.vendorOrderNumber || 'N/A'}</td>
                                      <td>
                                        {isEditingNote ? (
                                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                            <input
                                              type="text"
                                              value={editNoteValue}
                                              onChange={(e) => setEditNoteValue(e.target.value)}
                                              style={{ flex: 1, minWidth: '150px', padding: '0.25rem' }}
                                              placeholder="Add note..."
                                            />
                                            <button
                                              className="btn btn-small"
                                              onClick={() => handleSaveNote(request.id, editNoteValue)}
                                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                            >
                                              Save
                                            </button>
                                            <button
                                              className="btn btn-small"
                                              onClick={() => {
                                                setEditingNoteId(null);
                                                setEditNoteValue('');
                                              }}
                                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
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
                                            style={{ cursor: 'pointer', color: request.notes ? '#0066cc' : '#999', fontSize: '0.9rem' }}
                                            title="Click to add or edit note"
                                          >
                                            {request.notes || 'Click to add...'}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
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
                              setEditQtyValue(String(request.quantity ?? (request as any).qty ?? ''));
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {request.quantity ?? (request as any).qty ?? ''}
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
              <button
                className={`filter-btn ${historyDays === 180 ? 'active' : ''}`}
                onClick={() => setHistoryDays(180)}
              >
                Last 180 Days
              </button>
              {!loadArchive ? (
                <button
                  className="btn btn-small"
                  onClick={() => {
                    setLoadArchive(true);
                    setHistoryDays('ALL');
                  }}
                  disabled={archiveLoading}
                >
                  {archiveLoading ? 'Loading Archive...' : 'Load Archive'}
                </button>
              ) : (
                <span className="muted" style={{ alignSelf: 'center' }}>Archive loaded</span>
              )}
              {loadArchive && (
                <button
                  className={`filter-btn ${historyDays === 'ALL' ? 'active' : ''}`}
                  onClick={() => setHistoryDays('ALL')}
                >
                  All History
                </button>
              )}
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
            </div>
            {historyItems.length === 0 ? (
              <p className="muted">
                {historyDays === 'ALL' ? 'No history found.' : `No history in the last ${historyDays} days.`}
              </p>
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
                      const itemName = resolveItemName(request);
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
                          <td>{request.quantity ?? (request as any).qty ?? ''}</td>
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

            <div className="modal-body">
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
                    {selectedItemId && (
                      <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#e3f2fd', borderRadius: '4px', color: '#0066cc', fontWeight: '500', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Selected: {catalogMap.get(selectedItemId)?.itemName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemId('');
                            setItemSearchTerm('');
                            setItemSearchFocused(false);
                          }}
                          style={{ background: '#ff6b6b', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Search for an item..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      onFocus={() => setItemSearchFocused(true)}
                      onBlur={() => setTimeout(() => setItemSearchFocused(false), 200)}
                      className="search-input"
                    />
                    {itemSearchFocused && (
                      <div className="select-list">
                        {catalog
                          .filter(item => item.active !== false)
                          .filter(item => {
                            if (!itemSearchTerm) return true;
                            const searchTerms = itemSearchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
                            const itemNameLower = item.itemName.toLowerCase();
                            const altNamesLower = (item.altNames || []).map(alt => alt.toLowerCase());
                            const itemRefLower = (item.itemRef || '').toLowerCase();
                            
                            return searchTerms.every(term => {
                              // Get all variations of the search term (e.g., "3ml" and "3 ml")
                              const variations = getSearchVariations(term);
                              
                              // Check if any variation matches in item name
                              const matchesName = variations.some(variation => itemNameLower.includes(variation));
                              if (matchesName) return true;
                              
                              // Check if any variation matches in item ref
                              const matchesRef = variations.some(variation => itemRefLower.includes(variation));
                              if (matchesRef) return true;
                              
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
                                setItemSearchTerm('');
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

              {duplicateRequestCandidate && (
                <div className="duplicate-warning">
                  <strong>⚠️ This item is already on the request list.</strong>
                  <div style={{ marginTop: '0.35rem' }}>
                    Current qty: {getRequestQuantity(duplicateRequestCandidate) || 'Not set'} • Status: {duplicateRequestCandidate.status || 'Open'}
                  </div>
                </div>
              )}

              <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <label>Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="5"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: '0 0 180px' }}>
                  <label>Unit</label>
                  <select
                    value={requestUnit}
                    onChange={(e) => setRequestUnit(e.target.value)}
                  >
                    <option value="">Select unit...</option>
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
                <button type="button" className="btn btn-primary" onClick={() => handleCreateRequest(false)}>
                  Submit and New
                </button>
                <button type="button" className="btn btn-primary" onClick={() => handleCreateRequest(true)}>
                  Submit and Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {duplicateRequestChoice && (
        <div className="modal-overlay" onClick={() => setDuplicateRequestChoice(null)}>
          <div className="modal-content duplicate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Duplicate Request Warning</h3>
              <button className="close-btn" onClick={() => setDuplicateRequestChoice(null)}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="duplicate-warning" style={{ marginTop: 0 }}>
                <strong>{resolveItemName(duplicateRequestChoice.existingRequest)}</strong> is already on the request list.
                <div style={{ marginTop: '0.35rem' }}>
                  Current qty: {getRequestQuantity(duplicateRequestChoice.existingRequest) || 'Not set'} • Status: {duplicateRequestChoice.existingRequest.status || 'Open'}
                </div>
              </div>

              <p style={{ marginTop: '1rem', marginBottom: 0 }}>
                Would you like to increase the existing request quantity or add a separate request anyway?
              </p>
            </div>

            <div className="modal-footer duplicate-actions">
              <button type="button" className="btn btn-cancel" onClick={() => setDuplicateRequestChoice(null)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={() => handleCreateRequest(duplicateRequestChoice.closeModal, true)}>
                Add Separate Request
              </button>
              <button type="button" className="btn btn-primary" onClick={handleIncreaseExistingRequest}>
                Increase Existing Qty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
