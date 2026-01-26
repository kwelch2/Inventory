import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export const Layout = ({ children, showNav = true }: LayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <div className="layout">
      {showNav && (
        <header className="header">
          <div className="header-content">
            <Link to="/" className="logo-link" onClick={closeMenu}>
              <img src="/Logo-1.jpg" alt="EMS Logo" className="logo" />
              <span className="logo-text">EMS Supplies</span>
            </Link>
            
            <button 
              className={`menu-toggle ${menuOpen ? 'active' : ''}`}
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>

            <nav className={`nav ${menuOpen ? 'open' : ''}`}>
              <Link to="/" className="nav-link" onClick={closeMenu}>
                Dashboard
              </Link>
              <Link to="/expiry" className="nav-link" onClick={closeMenu}>
                Expiring Supplies
              </Link>
              <Link to="/requests" className="nav-link" onClick={closeMenu}>
                Supply Requests
              </Link>
              {user && (
                <Link to="/admin" className="nav-link" onClick={closeMenu}>
                  Admin
                </Link>
              )}
              <a 
                href="https://chores-ems.gemfireems.org/" 
                className="nav-link"
                onClick={closeMenu}
              >
                EMS-Chores
              </a>
              <a 
                href="https://chores-ems.gemfireems.org/issues/" 
                className="nav-link"
                onClick={closeMenu}
              >
                EMS-Issues
              </a>
              
              {user ? (
                <div className="user-section">
                  <span className="user-email">{user.email}</span>
                  <button className="btn btn-outline" onClick={handleSignOut}>
                    Logout
                  </button>
                </div>
              ) : (
                <div className="user-section">
                  <Link to="/login" className="btn btn-primary" onClick={closeMenu}>
                    Admin Login
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </header>
      )}
      
      <main className="main-content">
        {children}
      </main>
      
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Gem County FIRE-EMS. All rights reserved.</p>
      </footer>
    </div>
  );
};
