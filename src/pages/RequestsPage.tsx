import './CommonPages.css';

export const RequestsPage = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Supply Requests</h1>
        <p className="page-subtitle">View and manage supply order requests</p>
      </div>
      
      <div className="content-card">
        <p className="coming-soon">
          📋 Supply requests management feature coming soon...
        </p>
        <p className="info-text">
          This page will allow you to view, create, and manage supply requests,
          track order status, and maintain inventory levels.
        </p>
      </div>
    </div>
  );
};
