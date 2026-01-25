import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ExpiryPage } from './pages/ExpiryPage';
import { RequestsPage } from './pages/RequestsPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/expiry" element={<Layout><ExpiryPage /></Layout>} />
          <Route path="/requests" element={<Layout><RequestsPage /></Layout>} />
          <Route path="/login" element={<Layout showNav={false}><LoginPage /></Layout>} />
          <Route path="/admin" element={<Layout><AdminPage /></Layout>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
