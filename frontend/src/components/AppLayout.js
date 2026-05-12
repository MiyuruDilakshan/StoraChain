import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
  const navigate  = useNavigate();
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close sidebar on navigation (mobile)
  useEffect(() => { setSidebarOpen(false); }, []);

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
  const refreshUser = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('user'));
      setUser(stored);
    } catch {}
  }, []);

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
      <Sidebar user={user} isMobile={isMobile} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main style={{
        flex: 1,
        marginLeft: isMobile ? 0 : 220,
        padding: isMobile ? '0 0 60px' : '36px 40px 60px',
        minHeight: '100vh',
        overflowX: 'hidden',
        maxWidth: isMobile ? '100vw' : 'calc(100vw - 220px)',
      }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
            position: 'sticky', top: 0, background: '#000', zIndex: 100, marginBottom: 8,
          }}>
            <button onClick={() => setSidebarOpen(true)} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '7px 9px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>
              <Menu size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#bf5af2,#2997ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 800 }}>S</span>
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>StoraChain</span>
            </div>
          </div>
        )}
        <div style={{ padding: isMobile ? '0 16px 0' : 0 }}>
          {/* Pass user + refreshUser down to all child pages */}
          {React.Children.map(children, child =>
            React.isValidElement(child)
              ? React.cloneElement(child, { user, refreshUser, isMobile })
              : child
          )}
        </div>
      </main>
    </div>
  );
}
