import { useState, useMemo } from 'react';

type FleetNeedsRow = {
  key: string;
  catalogId?: string;
  itemName: string;
  totalQty: number;
  unitNames: string[];
  worstDays: number;
};

type SortField = 'worstDays' | 'itemName' | 'totalQty' | 'unitCount';
type SortDir = 'asc' | 'desc';

type FleetNeedsTabProps = {
  fleetNeedsSummary: FleetNeedsRow[];
  onCreateRequest: (row: FleetNeedsRow) => void;
};

const getRowClass = (days: number): string => {
  if (days <= 0) return 'bad';
  if (days <= 30) return 'warn';
  return '';
};

export const FleetNeedsTab = ({ fleetNeedsSummary, onCreateRequest }: FleetNeedsTabProps) => {
  const [sortField, setSortField] = useState<SortField>('worstDays');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    return [...fleetNeedsSummary].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'worstDays': cmp = a.worstDays - b.worstDays; break;
        case 'itemName': cmp = a.itemName.localeCompare(b.itemName); break;
        case 'totalQty': cmp = a.totalQty - b.totalQty; break;
        case 'unitCount': cmp = a.unitNames.length - b.unitNames.length; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [fleetNeedsSummary, sortField, sortDir]);

  const arrow = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="content-card">
      <div className="section-header">
        <h2>Fleet Replenishment Insight</h2>
        <p className="muted">Items expiring within 90 days across all units (excluding OK / Replaced)</p>
      </div>

      {fleetNeedsSummary.length === 0 ? (
        <p className="muted" style={{ padding: '1rem' }}>No items expiring within 90 days across the fleet.</p>
      ) : (
        <div className="table-container">
          <table className="admin-table fleet-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('itemName')}>Item Name{arrow('itemName')}</th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('worstDays')}>Worst Expiry{arrow('worstDays')}</th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('totalQty')}>Total Qty{arrow('totalQty')}</th>
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('unitCount')}>Affected Units{arrow('unitCount')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.key} className={getRowClass(row.worstDays)}>
                  <td style={{ lineHeight: 1.3 }}>
                    <span style={{ fontWeight: 600 }}>{row.itemName}</span>
                    {!row.catalogId && <span className="tag unlisted-tag" style={{ marginLeft: '0.4rem' }}>Custom</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {row.worstDays <= 0 ? <span style={{ color: 'var(--danger, #c0392b)', fontWeight: 600 }}>Expired</span> : `${row.worstDays}d`}
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.totalQty}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {row.unitNames.map(name => (
                        <span key={name} className="tag" style={{ fontSize: '0.75rem', padding: '1px 6px' }}>{name}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => onCreateRequest(row)}
                    >
                      Create Request
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
