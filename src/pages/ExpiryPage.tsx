import { useState, useMemo } from 'react';
import { useInventoryData } from '../hooks/useInventoryData';
import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import type { InventoryItem } from '../types';
import './CommonPages.css';
import './ExpiryPage.css';

type ExpiryFilter = '30' | '60' | '90' | 'ALL';

export const ExpiryPage = () => {
  const { catalog, inventory, units, compartments, loading } = useInventoryData();
  const [rangeFilter, setRangeFilter] = useState<ExpiryFilter>('90');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ unitId: string; compartment: string; quantity: number; crewStatus: string; expiryDate: string }>({ unitId: '', compartment: '', quantity: 1, crewStatus: '', expiryDate: '' });
  
  // Add Item Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemSearchFocused, setItemSearchFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newItem, setNewItem] = useState({
    catalogId: '',
    customItemName: '',
    unitId: '',
    compartment: '',
    expiryDate: '',
    quantity: 1,
    note: '',
    isCustom: false
  });

  const getExpiryDate = (item: InventoryItem): Date | null => {
    if (!item.expiryDate) return null;
    
    if (typeof item.expiryDate === 'object' && 'seconds' in item.expiryDate) {
      return new Date(item.expiryDate.seconds * 1000);
    }
    
    return item.expiryDate instanceof Date ? item.expiryDate : null;
  };

  const getDaysUntilExpiry = (expiryDate: Date): number => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const getRowClass = (days: number): string => {
    if (days <= 0) return 'bad';
    if (days <= 30) return 'warn';
    return '';
  };

  const catalogMap = useMemo(() => {
    return new Map(catalog.map(item => [item.id, item]));
  }, [catalog]);

  const unitsMap = useMemo(() => {
    return new Map(units.map(unit => [unit.id, unit]));
  }, [units]);

  const filteredItems = useMemo(() => {
    let items = inventory
      .filter(item => {
        const status = (item.status || '').toLowerCase();
        return status !== 'ok' && status !== 'replaced';
      })
      .map(item => {
        const expiryDate = getExpiryDate(item);
        if (!expiryDate) return null;
        
        const daysToExpire = getDaysUntilExpiry(expiryDate);
        const catalogItem = item.catalogId ? catalogMap.get(item.catalogId) : null;
        const itemName = catalogItem ? catalogItem.itemName : (item.itemName || 'Unknown Item');
        const unit = unitsMap.get(item.unitId);
        
        return {
          ...item,
          expiryDate,
          daysToExpire,
          itemName,
          catalogItem,
          unitName: unit?.name || 'Unknown',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Apply range filter
    if (rangeFilter !== 'ALL') {
      const maxDays = parseInt(rangeFilter, 10);
      items = items.filter(item => item.daysToExpire <= maxDays);
    }

    // Apply unit filter
    if (unitFilter !== 'ALL') {
      items = items.filter(item => item.unitId === unitFilter);
    }

    // Apply search filter with better matching
    if (searchTerm) {
      const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
      
      items = items.filter(item => {
        const itemNameLower = item.itemName.toLowerCase();
        const compartmentLower = (item.compartment || '').toLowerCase();
        const unitNameLower = item.unitName.toLowerCase();
        const altNamesLower = (item.catalogItem?.altNames || []).map(alt => alt.toLowerCase());
        const crewStatusLower = (item.crewStatus || '').toLowerCase();
        
        // Check if all search terms match somewhere in the item data
        return searchTerms.every(term => {
          const variations = getSearchVariations(term);
          
          // Check item name
          if (variations.some(v => itemNameLower.includes(v))) return true;
          
          // Check compartment
          if (variations.some(v => compartmentLower.includes(v))) return true;
          
          // Check unit name
          if (variations.some(v => unitNameLower.includes(v))) return true;
          
          // Check crew status/notes
          if (variations.some(v => crewStatusLower.includes(v))) return true;
          
          // Check alternative names
          if (altNamesLower.some(altName => 
            variations.some(v => altName.includes(v))
          )) return true;
          
          return false;
        });
      });
    }

    // Sort logic: when a specific unit is selected, sort by days to expire then by item name
    // When ALL units selected, sort by days to expire, then by unit, then by item name
    if (unitFilter !== 'ALL') {
      // Specific unit selected - sort by days to expire, then by item name
      items.sort((a, b) => {
        if (a.daysToExpire !== b.daysToExpire) {
          return a.daysToExpire - b.daysToExpire;
        }
        return a.itemName.localeCompare(b.itemName);
      });
    } else {
      // All units - sort by days to expire, then by unit, then by item name
      items.sort((a, b) => {
        if (a.daysToExpire !== b.daysToExpire) {
          return a.daysToExpire - b.daysToExpire;
        }
        if (a.unitName !== b.unitName) {
          return a.unitName.localeCompare(b.unitName);
        }
        return a.itemName.localeCompare(b.itemName);
      });
    }

    return items;
  }, [inventory, catalogMap, unitsMap, rangeFilter, unitFilter, searchTerm]);


  const historyItems = useMemo(() => {
    return inventory
      .filter(item => item.status === 'OK' || item.status === 'Replaced')
      .map(item => {
        const catalogItem = item.catalogId ? catalogMap.get(item.catalogId) : null;
        const itemName = catalogItem ? catalogItem.itemName : (item.itemName || 'Unknown Item');
        const unit = unitsMap.get(item.unitId);
        const expiryDate = getExpiryDate(item);
        
        return {
          ...item,
          catalogItem,
          itemName,
          unitName: unit?.name || 'Unknown',
          expiryDate
        };
      })
      .sort((a, b) => {
        const aTime = a.updatedAt && typeof a.updatedAt === 'object' && 'seconds' in a.updatedAt 
          ? a.updatedAt.seconds 
          : 0;
        const bTime = b.updatedAt && typeof b.updatedAt === 'object' && 'seconds' in b.updatedAt 
          ? b.updatedAt.seconds 
          : 0;
        return bTime - aTime; // Most recent first
      })
      .slice(0, 50);
  }, [inventory, catalogMap, unitsMap]);

  const handleUpdateStatus = async (id: string, newStatus: 'Pending' | 'OK' | 'Replaced') => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditValues({
      unitId: item.unitId,
      compartment: item.compartment || '',
      quantity: item.qty ?? item.quantity ?? 1,
      crewStatus: item.crewStatus || '',
      expiryDate: formatDateInput(getExpiryDate(item))
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({ unitId: '', compartment: '', quantity: 1, crewStatus: '', expiryDate: '' });
  };

  const handleSaveEdit = async (id: string) => {
    if (isNaN(editValues.quantity) || editValues.quantity < 0) {
      alert('Please enter a valid quantity');
      return;
    }

    try {
      await updateDoc(doc(db, 'inventory', id), {
        unitId: editValues.unitId,
        compartment: editValues.compartment,
        qty: editValues.quantity,
        crewStatus: editValues.crewStatus.trim(),
        expiryDate: editValues.expiryDate ? new Date(editValues.expiryDate) : null,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString();
  };

  const formatDateInput = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateTime = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleString();
  };

  const handleOpenAddModal = () => {
  };

  
    const handleSaveNewItem = async (closeAfter: boolean = false) => {
      // Validation
      if (!newItem.isCustom && !newItem.catalogId) {
        alert('Please select an item from the catalog');
        return;
      }
      if (newItem.isCustom && !newItem.customItemName.trim()) {
        alert('Please enter a custom item name');
        return;
      }
      if (!newItem.unitId) {
        alert('Please select a unit');
        return;
      }
      if (!newItem.expiryDate) {
        alert('Please select an expiry date');
        return;
      }
      if (isNaN(newItem.quantity) || newItem.quantity < 1) {
        alert('Please enter a valid quantity');
        return;
      }
  
      // Check for duplicates - only check Item, Unit, Compartment, and Expiry Date
      const expiryDateObj = new Date(newItem.expiryDate);
      const isDuplicate = inventory.some(item => {
        if (item.status === 'Replaced' || item.status === 'OK') return false;
        
        // Check if same item (catalog or custom)
        const matchesItem = newItem.isCustom 
          ? (item.itemName === newItem.customItemName.trim())
          : (item.catalogId === newItem.catalogId);
        
        if (!matchesItem) return false;
        
        // Check unit
        if (item.unitId !== newItem.unitId) return false;
        
        // Check compartment (normalize both to handle empty strings)
        const itemComp = (item.compartment || '').trim().toLowerCase();
        const newComp = (newItem.compartment || '').trim().toLowerCase();
        if (itemComp !== newComp) return false;
        
        // Check expiry date
        const itemExpiry = getExpiryDate(item);
        if (!itemExpiry) return false;
        
        return itemExpiry.toDateString() === expiryDateObj.toDateString();
      });
  
      if (isDuplicate) {
        const confirmAdd = confirm(
          'A similar item already exists with the same Unit, Compartment, and Expiry Date. Do you want to add it anyway?'
        );
        if (!confirmAdd) return;
      }
  
      // Prepare payload
      const payload: any = {
        unitId: newItem.unitId,
        compartment: newItem.compartment.trim(),
        expiryDate: expiryDateObj,
        qty: newItem.quantity,
        status: '',
        crewStatus: newItem.note.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
  
      if (newItem.isCustom) {
        payload.itemName = newItem.customItemName.trim();
      } else {
        payload.catalogId = newItem.catalogId;
      }
  
      try {
        await addDoc(collection(db, 'inventory'), payload);
        setNewItem(prev => ({
          catalogId: '',
          customItemName: '',
          unitId: prev.unitId,
          compartment: prev.compartment,
          expiryDate: '',
          quantity: 1,
          note: '',
          isCustom: prev.isCustom
        }));
        setItemSearchTerm('');
        setItemSearchFocused(false);
        if (closeAfter) {
          handleCloseAddModal();
        }
      } catch (error) {
        console.error('Error adding item:', error);
        alert('Failed to add item: ' + (error as Error).message);
      }
    };
  
    // Calculate expiry date for quick selection chips (handles month-end dates correctly)
  const getQuickExpiryDate = (monthsAhead: number): string => {
    // Start from first day of current month to avoid month-end edge cases
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // Get the target month by adding monthsAhead to current month
    const targetDate = new Date(year, month + monthsAhead, 1);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    
    // Get last day of target month (day 0 of next month = last day of current month)
    const lastDay = new Date(targetYear, targetMonth + 1, 0);
    
    const resultYear = lastDay.getFullYear();
    const resultMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
    const resultDay = String(lastDay.getDate()).padStart(2, '0');
    return `${resultYear}-${resultMonth}-${resultDay}`;
  };
  
  
  if (loading) {
    return (
      <div className="page-container">
        <p>Loading expiry data...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Expiring Supplies</h1>
        <p className="page-subtitle">
          Monitoring expiration dates. Highlight upcoming expirations in pink or circle them in red 90 days out, and record them here.
        </p>
      </div>

      <div className="controls-section">
        <div className="control-group">
          <label htmlFor="rangeFilter">Window</label>
          <select
            id="rangeFilter"
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value as ExpiryFilter)}
          >
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="ALL">All</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="unitFilter">Unit</label>
          <select
            id="unitFilter"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
          >
            <option value="ALL">ALL</option>
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </div>

        <div className="control-group search-control">
          <label htmlFor="itemSearch">Search</label>
          <input
            id="itemSearch"
            type="text"
            className="expiry-search-input"
            placeholder="Search items, compartments, units..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="count-display">
          {filteredItems.length} item(s)
        </div>

        <button className="btn btn-add-item" onClick={handleOpenAddModal}>
          + Add Item
        </button>
      </div>

      <div className="content-card">
        {filteredItems.length === 0 ? (
          <p className="muted">No expiring items match your criteria.</p>
        ) : (
          <div className="table-container">
            <table className="expiry-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Compartment</th>
                  <th>Qty</th>
                  <th>Expiry</th>
                  <th>Notes</th>
                  <th>Days Left</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const isEditing = editingId === item.id;
                  const rowClass = getRowClass(item.daysToExpire);
                  
                  return (
                    <tr key={item.id} className={rowClass}>
                      <td>
                        <div className="item-name-cell">
                          <span>{item.itemName}</span>
                          {item.catalogItem?.altNames && item.catalogItem.altNames.length > 0 && (
                            <span className="alt-names-small">({item.catalogItem.altNames.join(', ')})</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            value={editValues.unitId}
                            onChange={(e) => setEditValues({ ...editValues, unitId: e.target.value })}
                          >
                            {units.map(unit => (
                              <option key={unit.id} value={unit.id}>{unit.name}</option>
                            ))}
                          </select>
                        ) : (
                          item.unitName
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            value={editValues.compartment}
                            onChange={(e) => setEditValues({ ...editValues, compartment: e.target.value })}
                          >
                            <option value="">Select...</option>
                            {compartments?.filter(comp => comp?.id && comp?.name).map(comp => (
                              <option key={String(comp.id)} value={comp.name}>{comp.name}</option>
                            ))}
                          </select>
                        ) : (
                          item.compartment || 'N/A'
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editValues.quantity}
                            onChange={(e) => setEditValues({ ...editValues, quantity: parseInt(e.target.value, 10) })}
                            style={{ width: '60px' }}
                          />
                        ) : (
                          item.qty ?? item.quantity ?? 'N/A'
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editValues.expiryDate}
                            onChange={(e) => setEditValues({ ...editValues, expiryDate: e.target.value })}
                          />
                        ) : (
                          formatDate(item.expiryDate)
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Notes"
                            value={editValues.crewStatus}
                            onChange={(e) => setEditValues({ ...editValues, crewStatus: e.target.value })}
                          />
                        ) : (
                          item.crewStatus || '—'
                        )}
                      </td>
                      <td className="days-cell">
                        <span className={`days-badge ${rowClass}`}>
                          {item.daysToExpire < 0 
                            ? `${Math.abs(item.daysToExpire)} days ago` 
                            : `${item.daysToExpire} days`}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {isEditing ? (
                          <div className="action-buttons">
                            <button
                              className="btn btn-save"
                              onClick={() => handleSaveEdit(item.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-cancel"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="action-buttons">
                            <button
                              className="btn btn-edit"
                              onClick={() => handleStartEdit(item)}
                            >
                              Edit
                            </button>
                            <button
                              className={`btn btn-pending ${item.status === 'Pending' ? 'active' : ''}`}
                              onClick={() => handleUpdateStatus(item.id, 'Pending')}
                            >
                              Pending
                            </button>
                            <button
                              className="btn btn-ok"
                              onClick={() => handleUpdateStatus(item.id, 'OK')}
                            >
                              OK
                            </button>
                            <button
                              className="btn btn-replaced"
                              onClick={() => handleUpdateStatus(item.id, 'Replaced')}
                            >
                              Replaced
                            </button>
                          </div>
                        )}
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
            Recently Replaced / OK'd
          </summary>
          <div style={{ marginTop: '1rem' }}>
            {historyItems.length === 0 ? (
              <p className="muted">No items have been marked OK or Replaced recently.</p>
            ) : (
              <div className="table-container">
                <table className="expiry-table history-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit</th>
                      <th>Compartment</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div className="item-name-cell">
                            <span>{item.itemName}</span>
                            {item.catalogItem?.altNames && item.catalogItem.altNames.length > 0 && (
                              <span className="alt-names-small">({item.catalogItem.altNames.join(', ')})</span>
                            )}
                          </div>
                        </td>
                        <td>{item.unitName}</td>
                        <td>{item.compartment || 'N/A'}</td>
                        <td>{item.expiryDate ? formatDate(item.expiryDate) : 'N/A'}</td>
                        <td>
                          <span className={`status-badge ${item.status === 'OK' ? 'status-ok' : 'status-replaced'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{formatDateTime(item.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseAddModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Inventory Item</h3>
              <button className="close-btn" onClick={handleCloseAddModal}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <div className="form-row space-between">
                  <label>Item Name</label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newItem.isCustom}
                      onChange={(e) => setNewItem({ ...newItem, isCustom: e.target.checked, catalogId: '', customItemName: '' })}
                    />
                    Not in catalog?
                  </label>
                </div>
                
                {newItem.isCustom ? (
                  <input
                    type="text"
                    placeholder="Enter custom item name..."
                    value={newItem.customItemName}
                    onChange={(e) => setNewItem({ ...newItem, customItemName: e.target.value })}
                  />
                ) : (
                  <div className="searchable-select">
                    {newItem.catalogId && (
                      <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#e3f2fd', borderRadius: '4px', color: '#0066cc', fontWeight: '500' }}>
                        Selected: {catalog.find(c => c.id === newItem.catalogId)?.itemName}
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      onFocus={() => setItemSearchFocused(true)}
                      onBlur={() => setTimeout(() => setItemSearchFocused(false), 200)}
                      className="search-input"
                    />
                    {(itemSearchFocused || itemSearchTerm) && !newItem.catalogId && (
                      <div className="select-list">
                        {catalog
                          .filter(item => {
                            if (!itemSearchTerm) return true;
                            
                            const searchTerms = itemSearchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
                            const itemNameLower = item.itemName.toLowerCase();
                            const altNamesLower = (item.altNames || []).map(alt => alt.toLowerCase());
                            
                            // Check if all search terms are found in item name or alt names
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
                          .map(item => (
                            <div
                              key={item.id}
                              className={`select-item ${newItem.catalogId === item.id ? 'selected' : ''}`}
                              onClick={() => {
                                setNewItem({ ...newItem, catalogId: item.id });
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
                        {catalog.filter(item => {
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

              <div className="form-row">
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    value={newItem.unitId}
                    onChange={(e) => setNewItem({ ...newItem, unitId: e.target.value })}
                  >
                    <option value="">Select unit...</option>
                    {units?.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Compartment</label>
                  <input
                    type="text"
                    list="compartment-list"
                    placeholder="e.g., Cabinet A"
                    value={newItem.compartment}
                    onChange={(e) => setNewItem({ ...newItem, compartment: e.target.value })}
                  />
                  <datalist id="compartment-list">
                    {compartments?.filter(comp => comp?.id && comp?.name).map(comp => (
                      <option key={String(comp.id)} value={comp.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: '0 0 150px' }}>
                  <label>Qty</label>
                  <div className="qty-controls">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setNewItem({ ...newItem, quantity: Math.max(1, newItem.quantity - 1) })}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value, 10) || 1 })}
                      style={{ textAlign: 'center' }}
                    />
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setNewItem({ ...newItem, quantity: newItem.quantity + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Broken seal check"
                    value={newItem.note}
                    onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Expiry Date</label>
                <div className="expiry-chips">
                  {[1, 2, 3].map(months => {
                    const dateValue = getQuickExpiryDate(months);
                    const dateObj = new Date(dateValue);
                    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    
                    return (
                      <button
                        key={months}
                        type="button"
                        className={`chip-btn ${newItem.expiryDate === dateValue ? 'selected' : ''}`}
                        onClick={() => setNewItem({ ...newItem, expiryDate: dateValue })}
                      >
                        {monthName}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="date"
                  value={newItem.expiryDate}
                  onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                  style={{ marginTop: '0.5rem' }}
                />
              </div>

              <div className="form-row">
                
 
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-cancel" onClick={handleCloseAddModal}>Close</button>
              <button className="btn btn-save" onClick={() => handleSaveNewItem(true)}>Save & Close</button>
              <button className="btn btn-primary" onClick={() => handleSaveNewItem(false)}>Save & New</button>
            </div>
          </div>
        </div>
      )}

      {/* Search Section - Positioned at bottom for better iPad UX */}
      <div className="search-section">
        <div className="search-container">
          <label htmlFor="itemSearch" className="search-label">Search Items</label>
          <input
            id="itemSearch"
            type="text"
            className="search-input"
            placeholder="Type to search items, compartments, units..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {searchTerm && (
            <button 
              className="search-clear"
              onClick={() => setSearchTerm('')}
              type="button"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

