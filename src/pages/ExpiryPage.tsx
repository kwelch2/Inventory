import './CommonPages.css';

export const ExpiryPage = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Expiring Supplies</h1>
        <p className="page-subtitle">Monitor supplies approaching expiration dates</p>
      </div>
      
      <div className="content-card">
        <p className="coming-soon">
          📦 Expiring supplies tracking feature coming soon...
        </p>
        <p className="info-text">
          This page will display all inventory items that are approaching their expiration dates,
          allowing you to take action before supplies expire.
        </p>
      </div>
    </div>
  );
};
