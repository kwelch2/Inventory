import type { Vendor, CatalogItem } from '../../types';

type SettingsTabProps = {
  settingsSection: 'units' | 'compartments' | 'categories' | 'vendors';
  setSettingsSection: (value: 'units' | 'compartments' | 'categories' | 'vendors') => void;
  vendors: Vendor[];
  categories: { id: string; name: string }[];
  compartments: { id: string; name: string }[];
  units: { id: string; name: string }[];
  catalog: CatalogItem[];
  openEditVendor: (vendor?: Vendor) => void;
  handleDeleteVendor: (id: string) => void;
  handleAddSettingsItem: (collectionName: string) => void;
  handleDeleteSettingsItem: (collectionName: string, id: string) => void;
  newItemName: string;
  setNewItemName: (value: string) => void;
};

export const SettingsTab = ({
  settingsSection,
  setSettingsSection,
  vendors,
  categories,
  compartments,
  units,
  catalog,
  openEditVendor,
  handleDeleteVendor,
  handleAddSettingsItem,
  handleDeleteSettingsItem,
  newItemName,
  setNewItemName
}: SettingsTabProps) => {
  return (
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
  );
};
