import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Upload,
  ShoppingBag, BarChart2, Wallet, Terminal,
  User, HardDrive, LogOut, Coins, ShieldAlert, CreditCard, Shield,
} from 'lucide-react';

const SIDEBAR_W = 220;

const PLAN_COLORS = { free: '#30d158', basic: '#2997ff', pro: '#bf5af2', premium: '#ff9f0a' };
const PLAN_LABELS = { free: 'Free', basic: 'Basic', pro: 'Pro', premium: 'Premium' };

const seekerNav = [
  { to: '/app/dashboard',   icon: <LayoutDashboard size={17} />, label: 'Dashboard'    },
  { to: '/app/files',       icon: <FolderOpen      size={17} />, label: 'My Files'     },
  { to: '/app/upload',      icon: <Upload          size={17} />, label: 'Upload'       },
  { to: '/app/marketplace', icon: <ShoppingBag     size={17} />, label: 'Marketplace'  },
  { to: '/app/plans',       icon: <CreditCard      size={17} />, label: 'My Plan'      },
  { to: '/app/analytics',   icon: <BarChart2       size={17} />, label: 'Analytics'    },
  { to: '/app/abuse',       icon: <ShieldAlert     size={17} />, label: 'Safety'       },
  { to: '/app/profile',     icon: <User            size={17} />, label: 'Profile'      },
];

const providerNav = [
  { to: '/app/dashboard',   icon: <LayoutDashboard size={17} />, label: 'Dashboard'      },
  { to: '/app/node',        icon: <HardDrive       size={17} />, label: 'My Storage Node' },
  { to: '/app/marketplace', icon: <ShoppingBag     size={17} />, label: 'Marketplace'    },
  { to: '/app/withdraw',    icon: <Wallet          size={17} />, label: 'Withdraw'        },
  { to: '/app/analytics',   icon: <BarChart2       size={17} />, label: 'Analytics'       },
  { to: '/app/abuse',       icon: <ShieldAlert     size={17} />, label: 'Safety'          },
  { to: '/app/setup',       icon: <Terminal        size={17} />, label: 'Node Setup'      },
  { to: '/app/profile',     icon: <User            size={17} />, label: 'Profile'         },
];

// Admin nav — only admin-relevant links
const adminNav = [
  { to: '/admin',           icon: <Shield      size={17} />, label: 'Admin Dashboard', end: true },
  { to: '/app/marketplace', icon: <ShoppingBag size={17} />, label: 'Marketplace'    },
];

export default function Sidebar({ user }) {
  const navigate = useNavigate();
  const role      = user?.role || 'seeker';
  const isProvider = role === 'provider';
  const isAdmin    = role === 'admin';

  const accent    = isAdmin ? '#bf5af2' : isProvider ? '#30d158' : '#2997ff';
  const navItems  = isAdmin ? adminNav : isProvider ? providerNav : seekerNav;

  const initial   = (user?.name || 'U').charAt(0).toUpperCase();
  const avatarBg  = user?.avatarColor || '#bf5af2';
  const plan      = user?.plan || 'free';
  const planColor = PLAN_COLORS[plan] || '#30d158';
  const planLabel = PLAN_LABELS[plan] || 'Free';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const homeRoute = isAdmin ? '/admin' : '/app/dashboard';

  return (
    <div style={{
      position:   'fixed', top: 0, left: 0, bottom: 0,
      width:      SIDEBAR_W,
      background: '#050505',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display:    'flex', flexDirection: 'column',
      zIndex:     200,
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          onClick={() => navigate(homeRoute)}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg,#bf5af2,#2997ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HardDrive size={15} color="#fff" />
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
            StoraChain
          </span>
        </div>
      </div>

      {/* User chip */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: isAdmin ? 'rgba(191,90,242,0.07)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isAdmin ? 'rgba(191,90,242,0.2)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: avatarBg + '33',
            border: `2px solid ${avatarBg}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 800, color: avatarBg, flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent }} />
              <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Non-admin: wallet + plan badge */}
        {!isAdmin && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 10px',
              background: 'rgba(255,159,10,0.08)',
              border: '1px solid rgba(255,159,10,0.15)',
              borderRadius: 8,
            }}>
              <Coins size={12} color="#ff9f0a" />
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ff9f0a' }}>
                {user?.sctBalance ?? '—'} SCT
              </span>
            </div>
            {!isProvider && (
              <div
                onClick={() => navigate('/app/plans')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px',
                  background: `${planColor}10`,
                  border: `1px solid ${planColor}30`,
                  borderRadius: 8, cursor: 'pointer',
                }}
                title="Manage plan"
              >
                <CreditCard size={11} color={planColor} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: planColor }}>{planLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Admin: special badge */}
        {isAdmin && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.25)', borderRadius: 8, textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#bf5af2', letterSpacing: '0.07em' }}>⚡ Full System Access</span>
          </div>
        )}
      </div>

      {/* Nav separator */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px 8px' }} />

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 10px', overflowY: 'auto' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to + (item.end ? '_end' : '')}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        '9px 12px',
              borderRadius:   10,
              marginBottom:   3,
              textDecoration: 'none',
              fontSize:       '0.84rem',
              fontWeight:     600,
              transition:     'all 0.15s',
              color:          isActive ? '#fff' : 'rgba(255,255,255,0.45)',
              background:     isActive ? `${accent}18` : 'transparent',
              borderLeft:     isActive ? `3px solid ${accent}` : '3px solid transparent',
            })}
          >
            {React.cloneElement(item.icon, {})}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: logout */}
      <div style={{ padding: '12px 10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 10,
            background: 'transparent', border: 'none',
            color: 'rgba(255,55,95,0.7)', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,55,95,0.1)'; e.currentTarget.style.color = '#ff375f'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,55,95,0.7)'; }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );
}
