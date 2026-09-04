import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { isAuthorizedAdmin } from '../utils/auth';

export const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-container"><p>Restoring session...</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAuthorizedAdmin(user)) {
    return (
      <div className="page-container">
        <div className="content-card error-card">
          <h1>Access Denied</h1>
          <p>You must use a @gemfireems.org email address to access the admin panel.</p>
          <button className="btn btn-primary" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children;
};
