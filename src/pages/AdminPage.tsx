import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, updateDoc, addDoc, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useInventoryData } from '../hooks/useInventoryData';
import type { CatalogItem, Vendor, Category } from '../types';
import './AdminPage.css';

type AdminTab = 'overview' | 'catalog' | 'vendors' | 'categories' | 'compartments' | 'requests';

interface FormData {
  itemName?: string;
  itemRef?: string;
  category?: string;
  unit?: string;
  packSize?: number | string;
  parLevel?: number | string;
  active?: boolean;
  name?: string;
  phone?: string;
  email?: string;
  webUrl?: string;
  notes?: string;
  // Allow any property for compatibility with data models
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export const AdminPage = () => {
  const { user, loading } = useAuth();
  const { catalog, vendors, categories, compartments, requests, loading: dataLoading } = useInventoryData();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | Vendor | Category | null>(null);

  // Form states
  const [formData, setFormData] = useState<FormData>({});

  if (loading) {
    return (
      <div className="admin-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Check if user has gemfireems.org domain
  const isAuthorized = user.email?.endsWith('@gemfireems.org');

  if (!isAuthorized) {
    return (
      <div className="page-container">
        <div className="content-card error-card">
          <h1>Access Denied</h1>
          <p>You must have a @gemfireems.org email to access the admin panel.</p>
          <p className="user-info">Current user: {user.email}</p>
        </div>
      </div>
    );
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev: FormData) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'catalog'), {
        ...formData,
        active: formData.active ?? true,
        createdAt: serverTimestamp()
      });
      setFormData({});
      setShowAddForm(false);
      alert('Item added successfully!');
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    }
  };

  const handleUpdateCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    try {
      await updateDoc(doc(db, 'catalog', editingItem.id), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setEditingItem(null);
      setFormData({});
      alert('Item updated successfully!');
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    }
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await deleteDoc(doc(db, 'catalog', id));
      alert('Item deleted successfully!');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'vendors'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      setFormData({});
      setShowAddForm(false);
      alert('Vendor added successfully!');
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Failed to add vendor');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'categories'), {
        name: formData.name,
        createdAt: serverTimestamp()
      });
      setFormData({});
      setShowAddForm(false);
      alert('Category added successfully!');
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category');
    }
  };

  const handleAddCompartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'compartments'), {
        name: formData.name,
        createdAt: serverTimestamp()
      });
      setFormData({});
      setShowAddForm(false);
      alert('Compartment added successfully!');
    } catch (error) {
      console.error('Error adding compartment:', error);
      alert('Failed to add compartment');
    }
  };

  const handleDeleteCompartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this compartment?')) return;
    try {
      await deleteDoc(doc(db, 'compartments', id));
      alert('Compartment deleted successfully!');
    } catch (error) {
      console.error('Error deleting compartment:', error);
      alert('Failed to delete compartment');
    }
  };

  const startEdit = (item: CatalogItem | Vendor | Category) => {
    setEditingItem(item);
    // Convert item to FormData type - all values are compatible
    const data: FormData = { ...item };
    setFormData(data);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setFormData({});
  };

  const stats = {
    totalItems: catalog.length,
    activeItems: catalog.filter(item => item.active !== false).length,
    totalVendors: vendors.length,
    openRequests: requests.filter(r => r.status === 'Open').length,
    totalCategories: categories.length,
    totalCompartments: compartments.length
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p className="page-subtitle">Manage inventory, orders, and system settings</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          Catalog
        </button>
        <button 
          className={`tab-btn ${activeTab === 'vendors' ? 'active' : ''}`}
          onClick={() => setActiveTab('vendors')}
        >
          Vendors
        </button>
        <button 
          className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button 
          className={`tab-btn ${activeTab === 'compartments' ? 'active' : ''}`}
          onClick={() => setActiveTab('compartments')}
        >
          Compartments
        </button>
        <button 
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests
        </button>
      </div>

      {dataLoading ? (
        <div className="content-card">
          <p>Loading data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="admin-grid">
              <div className="admin-card">
                <h2>📦 Catalog Items</h2>
                <p>Manage supply catalog</p>
                <div className="stats">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalItems}</span>
                    <span className="stat-label">Total Items</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.activeItems}</span>
                    <span className="stat-label">Active Items</span>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h2>🏢 Vendors</h2>
                <p>Manage vendor information</p>
                <div className="stats">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalVendors}</span>
                    <span className="stat-label">Total Vendors</span>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h2>📋 Open Requests</h2>
                <p>Supply requests pending</p>
                <div className="stats">
                  <div className="stat-item">
                    <span className="stat-value">{stats.openRequests}</span>
                    <span className="stat-label">Open Orders</span>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h2>📊 Categories</h2>
                <p>Item categories</p>
                <div className="stats">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalCategories}</span>
                    <span className="stat-label">Categories</span>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h2>📦 Compartments</h2>
                <p>Storage compartments</p>
                <div className="stats">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalCompartments}</span>
                    <span className="stat-label">Compartments</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="content-card">
              <div className="section-header">
                <h2>Catalog Management</h2>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    setEditingItem(null);
                    setFormData({});
                  }}
                >
                  {showAddForm ? 'Cancel' : '+ Add Item'}
                </button>
              </div>

              {(showAddForm || editingItem) && (
                <form onSubmit={editingItem ? handleUpdateCatalogItem : handleAddCatalogItem} className="admin-form">
                  <h3>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Item Name *</label>
                      <input
                        type="text"
                        name="itemName"
                        value={String(formData.itemName || '')}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Item Reference</label>
                      <input
                        type="text"
                        name="itemRef"
                        value={String(formData.itemRef || '')}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        name="category"
                        value={String(formData.category || '')}
                        onChange={handleFormChange}
                      >
                        <option value="">Select category...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <input
                        type="text"
                        name="unit"
                        value={String(formData.unit || '')}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Pack Size</label>
                      <input
                        type="number"
                        name="packSize"
                        value={formData.packSize !== undefined ? String(formData.packSize) : ''}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Par Level</label>
                      <input
                        type="number"
                        name="parLevel"
                        value={formData.parLevel !== undefined ? String(formData.parLevel) : ''}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        name="active"
                        checked={Boolean(formData.active ?? true)}
                        onChange={handleFormChange}
                      />
                      Active
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                      {editingItem ? 'Update Item' : 'Add Item'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Reference</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Par Level</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.sort((a, b) => a.itemName.localeCompare(b.itemName)).map(item => (
                      <tr key={item.id}>
                        <td>{item.itemName}</td>
                        <td>{item.itemRef || 'N/A'}</td>
                        <td>{categories.find(c => c.id === item.category)?.name || 'N/A'}</td>
                        <td>{item.unit || 'N/A'}</td>
                        <td>{item.parLevel || 'N/A'}</td>
                        <td>
                          <span className={`status-badge ${item.active !== false ? 'active' : 'inactive'}`}>
                            {item.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button className="btn-small btn-edit" onClick={() => startEdit(item)}>Edit</button>
                          <button className="btn-small btn-delete" onClick={() => handleDeleteCatalogItem(item.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="content-card">
              <div className="section-header">
                <h2>Vendor Management</h2>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    setFormData({});
                  }}
                >
                  {showAddForm ? 'Cancel' : '+ Add Vendor'}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddVendor} className="admin-form">
                  <h3>Add New Vendor</h3>
                  <div className="form-group">
                    <label>Vendor Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={String(formData.name || '')}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={String(formData.phone || '')}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        name="email"
                        value={String(formData.email || '')}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Website URL</label>
                    <input
                      type="url"
                      name="webUrl"
                      value={String(formData.webUrl || '')}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={String(formData.notes || '')}
                      onChange={handleFormChange}
                      rows={3}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">Add Vendor</button>
                </form>
              )}

              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.sort((a, b) => a.name.localeCompare(b.name)).map(vendor => (
                      <tr key={vendor.id}>
                        <td>{vendor.name}</td>
                        <td>{vendor.phone || 'N/A'}</td>
                        <td>{vendor.email || 'N/A'}</td>
                        <td>{vendor.webUrl ? <a href={vendor.webUrl} target="_blank" rel="noopener noreferrer">Link</a> : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="content-card">
              <div className="section-header">
                <h2>Category Management</h2>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    setFormData({});
                  }}
                >
                  {showAddForm ? 'Cancel' : '+ Add Category'}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddCategory} className="admin-form">
                  <h3>Add New Category</h3>
                  <div className="form-group">
                    <label>Category Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={String(formData.name || '')}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">Add Category</button>
                </form>
              )}

              <div className="categories-grid">
                {categories.sort((a, b) => a.name.localeCompare(b.name)).map(category => (
                  <div key={category.id} className="category-card">
                    <h3>{category.name}</h3>
                    <p>{catalog.filter(item => item.category === category.id).length} items</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'compartments' && (
            <div className="content-card">
              <div className="section-header">
                <h2>Compartment Management</h2>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    setFormData({});
                  }}
                >
                  {showAddForm ? 'Cancel' : '+ Add Compartment'}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddCompartment} className="admin-form">
                  <h3>Add New Compartment</h3>
                  <div className="form-group">
                    <label>Compartment Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={String(formData.name || '')}
                      onChange={handleFormChange}
                      placeholder="e.g., Airway Bag, Jump Bag, etc."
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">Add Compartment</button>
                </form>
              )}

              <div className="categories-grid">
                {compartments.sort((a, b) => a.name.localeCompare(b.name)).map(compartment => (
                  <div key={compartment.id} className="category-card">
                    <h3>{compartment.name}</h3>
                    <button 
                      className="btn btn-delete"
                      onClick={() => handleDeleteCompartment(compartment.id)}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="content-card">
              <h2>Request Statistics</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{requests.filter(r => r.status === 'Open').length}</span>
                  <span className="stat-label">Open</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{requests.filter(r => r.status === 'Ordered').length}</span>
                  <span className="stat-label">Ordered</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{requests.filter(r => r.status === 'Backordered').length}</span>
                  <span className="stat-label">Backordered</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{requests.filter(r => r.status === 'Received').length}</span>
                  <span className="stat-label">Received</span>
                </div>
              </div>
              <p className="info-text">
                For detailed request management, please visit the <a href="/requests">Requests page</a>.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
