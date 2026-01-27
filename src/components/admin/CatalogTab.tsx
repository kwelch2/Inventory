import type { CatalogItem, Vendor, VendorPrice } from '../../types';

type CatalogTabProps = {
  catalogSearch: string;
  setCatalogSearch: (value: string) => void;
  catalogCategoryFilter: string;
  setCatalogCategoryFilter: (value: string) => void;
  catalogActiveFilter: 'all' | 'active' | 'inactive';
  setCatalogActiveFilter: (value: 'all' | 'active' | 'inactive') => void;
  filteredCatalog: CatalogItem[];
  catalog: CatalogItem[];
  categories: { id: string; name: string }[];
  openEditCatalog: (item?: CatalogItem) => void;
  openEditPricing: (catalogId: string, price?: VendorPrice) => void;
  handleDeleteCatalogItem: (id: string) => void;
  getCatalogItemPricing: (item: CatalogItem) => VendorPrice[];
  vendorMap: Map<string, Vendor>;
  categoryMap: Map<string, string>;
};

export const CatalogTab = ({
  catalogSearch,
  setCatalogSearch,
  catalogCategoryFilter,
  setCatalogCategoryFilter,
  catalogActiveFilter,
  setCatalogActiveFilter,
  filteredCatalog,
  catalog,
  categories,
  openEditCatalog,
  openEditPricing,
  handleDeleteCatalogItem,
  getCatalogItemPricing,
  vendorMap,
  categoryMap
}: CatalogTabProps) => {
  return (
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
  );
};
