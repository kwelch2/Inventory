import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

export const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <img src="/Logo-1.jpg" alt="EMS Logo" className="dashboard-logo" />
        <h1>EMS Dashboard</h1>
        <p className="dashboard-subtitle">Inventory and Management System</p>
      </div>

      <div className="dashboard-grid">
        <a href="https://chores-ems.gemfireems.org/" className="dashboard-card external-card">
          <div className="card-icon">✓</div>
          <h2>EMS-Chores</h2>
          <p>Task management system</p>
        </a>

        <a href="https://chores-ems.gemfireems.org/issues/" className="dashboard-card external-card">
          <div className="card-icon">⚠️</div>
          <h2>EMS-Issues</h2>
          <p>Report and track issues</p>
        </a>

        <Link to="/expiry" className="dashboard-card supply-card">
          <div className="card-icon">📦</div>
          <h2>Expiring Supplies</h2>
          <p>View items approaching expiration dates</p>
        </Link>

        <Link to="/requests" className="dashboard-card supply-card">
          <div className="card-icon">📋</div>
          <h2>Supply Requests</h2>
          <p>Manage supply orders and requests</p>
        </Link>

        <a href="https://hub.gemfireems.org/" className="dashboard-card external-card">
          <div className="card-icon">🏢</div>
          <h2>EMS Hub</h2>
          <p>Employee directory, payroll, training, and FTO</p>
        </a>

        {user && (
          <Link to="/admin" className="dashboard-card admin-card">
            <div className="card-icon">🔧</div>
            <h2>Admin Panel</h2>
            <p>Manage catalog, vendors, and orders</p>
          </Link>
        )}
      </div>
    </div>
  );
};
