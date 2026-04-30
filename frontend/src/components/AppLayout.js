import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
  const navigate  = useNavigate();
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    try {
      const stored = JSON.parse(localStorage.getItem('user'));
      if (!stored) { navigate('/login'); return; }
      setUser(stored);
    } catch {
      navigate('/login');
      return;
    }
    setLoading(false);
  }, [navigate]);

  // Re-sync user from localStorage when it changes (e.g. profile update)
  const refreshUser = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('user'));
      setUser(stored);
    } catch {}
  };

  if (loading) {
    return (
      <div style={{
        background: '#000', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid rgba(191,90,242,0.3)',
            borderTopColor: '#bf5af2',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Loading...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', background: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar user={user} />
      <main style={{
        flex: 1,
        marginLeft: 220,
        padding: '36px 40px 60px',
        minHeight: '100vh',
        overflowX: 'hidden',
        maxWidth: 'calc(100vw - 220px)',
      }}>
        {/* Pass user + refreshUser down to all child pages */}
        {React.Children.map(children, child =>
          React.isValidElement(child)
            ? React.cloneElement(child, { user, refreshUser })
            : child
        )}
      </main>
    </div>
  );
}
