import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminPage.css';

export const AdminPage = () => {
  const { user, loading } = useAuth();

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

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p className="page-subtitle">Manage inventory, orders, and system settings</p>
      </div>

      <div className="admin-grid">
        <div className="admin-card">
          <h2>📦 Orders & Requests</h2>
          <p>Manage supply orders and requests from staff</p>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">-</span>
              <span className="stat-label">Open Orders</span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2>📚 Catalog Manager</h2>
          <p>Add and edit items in the supply catalog</p>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">-</span>
              <span className="stat-label">Total Items</span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2>🏢 Vendors</h2>
          <p>Manage vendor information and pricing</p>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">-</span>
              <span className="stat-label">Active Vendors</span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2>📊 Categories</h2>
          <p>Organize items by category</p>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">-</span>
              <span className="stat-label">Categories</span>
            </div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <p className="coming-soon">
          🔧 Full admin features coming soon...
        </p>
        <p className="info-text">
          The admin panel will include complete order management, catalog editing,
          vendor management, and reporting features.
        </p>
      </div>
    </div>
  );
};
