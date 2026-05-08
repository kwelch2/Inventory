import type { ReactNode } from 'react';

type OrderView = 'item' | 'vendor';

type VendorStatusGroup = {
  vendorName: string;
  open: any[];
  ordered: any[];
  backordered: any[];
  history: any[];
};

type OrdersTabProps = {
  orderView: OrderView;
  setOrderView: (view: OrderView) => void;
  openNewRequest: () => void;
  selectedRequests: Set<string>;
  setSelectedRequests: (next: Set<string>) => void;
  openOrderPreview: (vendorId?: string, vendorName?: string) => void;
  openRequests: any[];
  orderedRequests: any[];
  backorderRequests: any[];
  historyRequests: any[];
  archiveLoaded: boolean;
  archiveLoading: boolean;
  onLoadArchive: () => void;
  expandHistorySection: boolean;
  setExpandHistorySection: (next: boolean) => void;
  renderOrderRow: (r: any, rowClassName?: string) => ReactNode;
  vendorFilter: string;
  setVendorFilter: (value: string) => void;
  requestsByVendorAndStatus: Map<string, VendorStatusGroup>;
  getItemName: (request: any) => string;
};

export const OrdersTab = ({
  orderView,
  setOrderView,
  openNewRequest,
  selectedRequests,
  setSelectedRequests,
  openOrderPreview,
  openRequests,
  orderedRequests,
  backorderRequests,
  historyRequests,
  archiveLoaded,
  archiveLoading,
  onLoadArchive,
  expandHistorySection,
  setExpandHistorySection,
  renderOrderRow,
  vendorFilter,
  setVendorFilter,
  requestsByVendorAndStatus,
  getItemName
}: OrdersTabProps) => {
  return (
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
                                setSelectedRequests(new Set(openRequests.map((r: any) => r.id)));
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
                              {openRequests.map((r: any) => renderOrderRow(r, ''))}
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
                                setSelectedRequests(new Set(orderedRequests.map((r: any) => r.id)));
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
                              {orderedRequests.map((r: any) => renderOrderRow(r, 'row-ordered'))}
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
                                setSelectedRequests(new Set(backorderRequests.map((r: any) => r.id)));
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
                              {backorderRequests.map((r: any) => renderOrderRow(r, 'row-backordered'))}
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {!archiveLoaded ? (
                    <button
                      className="btn btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadArchive();
                      }}
                      disabled={archiveLoading}
                    >
                      {archiveLoading ? 'Loading Archive...' : 'Load Archive'}
                    </button>
                  ) : (
                    <span className="muted">Archive loaded</span>
                  )}
                <span className="expand-icon">{expandHistorySection ? '▼' : '▶'}</span>
                </div>
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
                                {historyRequests.map((r: any) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{getItemName(r)}</strong>
                              <br /><span className="muted">{r.requesterEmail || ''}</span>
                            </td>
                            <td>{r.qty || r.quantity || ''}</td>
                            <td><span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                            <td>{(r.receivedAt || r.updatedAt || r.createdAt) && typeof (r.receivedAt || r.updatedAt || r.createdAt) === 'object' && 'seconds' in (r.receivedAt || r.updatedAt || r.createdAt)
                              ? new Date((r.receivedAt || r.updatedAt || r.createdAt).seconds * 1000).toLocaleDateString()
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
        // Vendor view
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
                        const selectedCount = group.open.filter((r: any) => selectedRequests.has(r.id)).length;
                        
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
                                        checked={group.open.every((r: any) => selectedRequests.has(r.id))}
                                        onChange={(e) => {
                                          const next = new Set(selectedRequests);
                                          group.open.forEach((r: any) => {
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
                                  {group.open.map((r: any) => renderOrderRow(r, ''))}
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
                        const selectedCount = combinedItems.filter((r: any) => selectedRequests.has(r.id)).length;
                        
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
                                        checked={combinedItems.every((r: any) => selectedRequests.has(r.id))}
                                        onChange={(e) => {
                                          const next = new Set(selectedRequests);
                                          combinedItems.forEach((r: any) => {
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
                                  {combinedItems.map((r: any) => {
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
                    group.history.map((r: any) => ({ ...r, vendorName: group.vendorName }))
                  )
                  .sort((a, b) => {
                    const aDate = (a.receivedAt || a.updatedAt || a.createdAt) && typeof (a.receivedAt || a.updatedAt || a.createdAt) === 'object' && 'seconds' in (a.receivedAt || a.updatedAt || a.createdAt)
                      ? (a.receivedAt || a.updatedAt || a.createdAt).seconds
                      : 0;
                    const bDate = (b.receivedAt || b.updatedAt || b.createdAt) && typeof (b.receivedAt || b.updatedAt || b.createdAt) === 'object' && 'seconds' in (b.receivedAt || b.updatedAt || b.createdAt)
                      ? (b.receivedAt || b.updatedAt || b.createdAt).seconds
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
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {!archiveLoaded ? (
                          <button
                            className="btn btn-small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLoadArchive();
                            }}
                            disabled={archiveLoading}
                          >
                            {archiveLoading ? 'Loading Archive...' : 'Load Archive'}
                          </button>
                        ) : (
                          <span className="muted">Archive loaded</span>
                        )}
                      <span className="expand-icon">{expandHistorySection ? '▼' : '▶'}</span>
                      </div>
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
                              {allHistory.map((r: any) => (
                                <tr key={r.id}>
                                  <td>
                                    <strong>{getItemName(r)}</strong>
                                    <br /><span className="muted">{r.requesterEmail || ''}</span>
                                  </td>
                                  <td>{r.vendorName}</td>
                                  <td>{r.qty || r.quantity || ''} {r.unit || ''}</td>
                                  <td><span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                                  <td>{(r.receivedAt || r.updatedAt || r.createdAt) && typeof (r.receivedAt || r.updatedAt || r.createdAt) === 'object' && 'seconds' in (r.receivedAt || r.updatedAt || r.createdAt)
                                    ? new Date((r.receivedAt || r.updatedAt || r.createdAt).seconds * 1000).toLocaleDateString()
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
  );
};
