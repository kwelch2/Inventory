import { useState, useMemo } from 'react';
import { useInventoryData } from '../hooks/useInventoryData';
import type { CatalogItem } from '../types';
import './CommonPages.css';
import './ExpiryPage.css';

type ExpiryFilter = 'All' | 'Expired' | 'Next7Days' | 'Next30Days' | 'Next90Days';

export const ExpiryPage = () => {
  const { catalog, loading } = useInventoryData();
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const getExpirationDate = (item: CatalogItem): Date | null => {
    if (!item.expirationDate) return null;
    
    if (typeof item.expirationDate === 'object' && 'seconds' in item.expirationDate) {
      return new Date(item.expirationDate.seconds * 1000);
    }
    
    return item.expirationDate instanceof Date ? item.expirationDate : null;
  };

  const getDaysUntilExpiry = (expiryDate: Date): number => {
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (daysUntilExpiry: number): string => {
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 7) return 'critical';
    if (daysUntilExpiry <= 30) return 'warning';
    if (daysUntilExpiry <= 90) return 'caution';
    return 'good';
  };

  const filteredItems = useMemo(() => {
    let items = catalog
      .map(item => ({
        ...item,
        expirationDate: getExpirationDate(item),
      }))
      .filter(item => item.expirationDate !== null)
      .map(item => ({
        ...item,
        daysUntilExpiry: getDaysUntilExpiry(item.expirationDate!),
      }));

    // Apply expiry filter
    switch (expiryFilter) {
      case 'Expired':
        items = items.filter(item => item.daysUntilExpiry < 0);
        break;
      case 'Next7Days':
        items = items.filter(item => item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 7);
        break;
      case 'Next30Days':
        items = items.filter(item => item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 30);
        break;
      case 'Next90Days':
        items = items.filter(item => item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 90);
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.itemName.toLowerCase().includes(search) ||
        item.itemRef?.toLowerCase().includes(search) ||
        item.lotNumber?.toLowerCase().includes(search)
      );
    }

    // Sort by expiration date (earliest first)
    items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return items;
  }, [catalog, expiryFilter, searchTerm]);

  const stats = useMemo(() => {
    const itemsWithExpiry = catalog.filter(item => getExpirationDate(item) !== null);
    const expiredCount = itemsWithExpiry.filter(item => {
      const expDate = getExpirationDate(item);
      return expDate && getDaysUntilExpiry(expDate) < 0;
    }).length;
    const next7DaysCount = itemsWithExpiry.filter(item => {
      const expDate = getExpirationDate(item);
      if (!expDate) return false;
      const days = getDaysUntilExpiry(expDate);
      return days >= 0 && days <= 7;
    }).length;
    const next30DaysCount = itemsWithExpiry.filter(item => {
      const expDate = getExpirationDate(item);
      if (!expDate) return false;
      const days = getDaysUntilExpiry(expDate);
      return days >= 0 && days <= 30;
    }).length;

    return { expiredCount, next7DaysCount, next30DaysCount };
  }, [catalog]);

  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date.toLocaleDateString();
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
        <p className="page-subtitle">Monitor supplies approaching expiration dates</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card alert">
          <span className="stat-value">{stats.expiredCount}</span>
          <span className="stat-label">Expired Items</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-value">{stats.next7DaysCount}</span>
          <span className="stat-label">Expiring in 7 Days</span>
        </div>
        <div className="stat-card caution">
          <span className="stat-value">{stats.next30DaysCount}</span>
          <span className="stat-label">Expiring in 30 Days</span>
        </div>
      </div>

      <div className="controls-section">
        <div className="filter-buttons">
          {(['All', 'Expired', 'Next7Days', 'Next30Days', 'Next90Days'] as ExpiryFilter[]).map(filter => (
            <button
              key={filter}
              className={`filter-btn ${expiryFilter === filter ? 'active' : ''}`}
              onClick={() => setExpiryFilter(filter)}
            >
              {filter === 'Next7Days' ? 'Next 7 Days' : 
               filter === 'Next30Days' ? 'Next 30 Days' :
               filter === 'Next90Days' ? 'Next 90 Days' : filter}
            </button>
          ))}
        </div>
        
        <div className="search-box">
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="content-card">
        {filteredItems.length === 0 ? (
          <p className="muted">
            {catalog.filter(item => getExpirationDate(item) !== null).length === 0 
              ? 'No items with expiration dates found in inventory.'
              : 'No items match the selected filter.'}
          </p>
        ) : (
          <div className="table-container">
            <table className="expiry-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Reference</th>
                  <th>Lot Number</th>
                  <th>Quantity</th>
                  <th>Expiration Date</th>
                  <th>Days Until Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const status = getExpiryStatus(item.daysUntilExpiry);
                  return (
                    <tr key={item.id} className={`expiry-row-${status}`}>
                      <td>{item.itemName}</td>
                      <td>{item.itemRef || 'N/A'}</td>
                      <td>{item.lotNumber || 'N/A'}</td>
                      <td>{item.quantity || 'N/A'}</td>
                      <td>{formatDate(item.expirationDate)}</td>
                      <td>
                        <span className={`days-badge days-${status}`}>
                          {item.daysUntilExpiry < 0 
                            ? `${Math.abs(item.daysUntilExpiry)} days ago` 
                            : `${item.daysUntilExpiry} days`}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${status}`}>
                          {item.daysUntilExpiry < 0 ? 'EXPIRED' :
                           item.daysUntilExpiry <= 7 ? 'CRITICAL' :
                           item.daysUntilExpiry <= 30 ? 'WARNING' :
                           item.daysUntilExpiry <= 90 ? 'CAUTION' : 'GOOD'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
