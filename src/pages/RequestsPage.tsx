import { useState, useMemo } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useInventoryData } from '../hooks/useInventoryData';
import './CommonPages.css';
import './RequestsPage.css';

type StatusFilter = 'All' | 'Open' | 'Ordered' | 'Backordered' | 'Received' | 'Cancelled';

export const RequestsPage = () => {
  const { catalog, requests, vendors, loading } = useInventoryData();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [showHistory, setShowHistory] = useState(false);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Filter by history
    const historyStatuses = ['Received', 'Cancelled'];
    if (showHistory) {
      filtered = filtered.filter(r => historyStatuses.includes(r.status));
    } else {
      filtered = filtered.filter(r => !historyStatuses.includes(r.status));
    }

    // Filter by status
    if (statusFilter !== 'All') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => {
      const aTime = a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt 
        ? a.createdAt.seconds 
        : 0;
      const bTime = b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt 
        ? b.createdAt.seconds 
        : 0;
      return bTime - aTime;
    });

    return filtered;
  }, [requests, statusFilter, showHistory]);

  const getItemName = (itemId: string) => {
    const item = catalog.find(c => c.id === itemId);
    return item?.itemName || 'Unknown Item';
  };

  const getVendorName = (vendorId?: string) => {
    if (!vendorId) return 'Not Assigned';
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name || 'Unknown Vendor';
  };

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update request status');
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity) {
      alert('Please select an item and enter quantity');
      return;
    }

    try {
      await addDoc(collection(db, 'requests'), {
        itemId: selectedItemId,
        quantity,
        status: 'Open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setSelectedItemId('');
      setQuantity('1');
      setShowNewRequestForm(false);
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
        
        <div className="action-buttons">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
            />
            Show History
          </label>
          <button 
            className="btn btn-primary"
            onClick={() => setShowNewRequestForm(!showNewRequestForm)}
          >
            {showNewRequestForm ? 'Cancel' : '+ New Request'}
          </button>
        </div>
      </div>

      {showNewRequestForm && (
        <div className="content-card new-request-form">
          <h3>Create New Request</h3>
          <form onSubmit={handleCreateRequest}>
            <div className="form-group">
              <label>Item</label>
              <select 
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
              >
                <option value="">Select an item...</option>
                {catalog
                  .filter(item => item.active !== false)
                  .sort((a, b) => a.itemName.localeCompare(b.itemName))
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.itemName} {item.itemRef ? `(${item.itemRef})` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Create Request</button>
          </form>
        </div>
      )}

      <div className="content-card">
        {filteredRequests.length === 0 ? (
          <p className="muted">
            {showHistory ? 'No history found.' : 'No active requests found.'}
          </p>
        ) : (
          <div className="table-container">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Vendor</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(request => (
                  <tr key={request.id}>
                    <td>{getItemName(request.itemId)}</td>
                    <td>{request.quantity}</td>
                    <td>
                      <span className={`status-badge status-${request.status.toLowerCase()}`}>
                        {request.status}
                      </span>
                    </td>
                    <td>{getVendorName(request.vendorId)}</td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td>
                      {!showHistory && (
                        <select
                          className="status-select"
                          value={request.status}
                          onChange={(e) => handleStatusChange(request.id, e.target.value)}
                        >
                          <option value="Open">Open</option>
                          <option value="Ordered">Ordered</option>
                          <option value="Backordered">Backordered</option>
                          <option value="Received">Received</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
