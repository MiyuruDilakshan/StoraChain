import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { HiEye, HiEyeOff, HiArrowUp, HiArrowDown, HiServer, HiClock, HiWifi } from 'react-icons/hi';
import './ProviderDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ProviderDashboard() {
  const [providerId, setProviderId] = useState(localStorage.getItem('providerId'));
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [goingOnline, setGoingOnline] = useState(false);

  useEffect(() => {
    if (providerId) {
      fetchDashboard();
      const interval = setInterval(fetchDashboard, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [providerId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/providers/cli/${providerId}/dashboard`);
      if (res.data.success) {
        setDashboard(res.data);
        setError(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleGoOnline = async () => {
    try {
      setGoingOnline(true);

      // Get wallet address from input
      const walletAddress = prompt('Enter your Ethereum wallet address (0x...):');
      if (!walletAddress) {
        setGoingOnline(false);
        return;
      }

      const res = await axios.post(`${API_URL}/api/providers/cli/${providerId}/go-online`, {
        hddTotalGB: dashboard?.provider?.hdd?.totalGB || 0,
        walletAddress,
      });

      if (res.data.success) {
        alert(`✓ Provider is online!\n\n🎉 You received ${res.data.bonus} as a registration & online bonus!`);
        fetchDashboard();
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setGoingOnline(false);
    }
  };

  const handleGoOffline = async () => {
    if (!window.confirm('Are you sure you want to go offline?')) return;

    try {
      await axios.post(`${API_URL}/api/providers/cli/${providerId}/go-offline`);
      alert('Provider is now offline');
      fetchDashboard();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  if (!dashboard) {
    return (
      <div className="provider-dashboard">
        <div className="provider-loading">
          <h2>Loading provider dashboard...</h2>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  const { provider, earnings, withdrawals, balance } = dashboard;
  const statusColor =
    provider.status === 'online' ? '#10b981' : provider.status === 'offline' ? '#ef4444' : '#f59e0b';

  return (
    <div className="provider-dashboard">
      <header className="provider-header">
        <h1>📦 Provider Dashboard</h1>
        <div className="provider-status">
          <span
            className="status-badge"
            style={{
              backgroundColor: statusColor,
            }}
          >
            {provider.status.toUpperCase()}
          </span>
          <span className="provider-email">{provider.email}</span>
        </div>
      </header>

      <nav className="provider-tabs">
        {['overview', 'earnings', 'device', 'withdraw'].map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main className="provider-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="status-section">
              <div className="status-card">
                <h3>💰 Total Earnings</h3>
                <p className="amount">{balance.total.toFixed(4)} SCT</p>
                <p className="subtext">Available: {balance.available.toFixed(4)} SCT</p>
              </div>

              <div className="status-card">
                <h3>📥 Withdrawn</h3>
                <p className="amount">{balance.withdrawn.toFixed(4)} SCT</p>
                <p className="subtext">{withdrawals.filter((w) => w.status === 'completed').length} transactions</p>
              </div>

              <div className="status-card">
                <h3>💾 Storage Allocated</h3>
                <p className="amount">{provider.hdd?.totalGB || 0} GB</p>
                <p className="subtext">Free: {provider.hdd?.freeGB || 0} GB</p>
              </div>

              <div className="status-card">
                <h3>⏱️ Uptime</h3>
                <p className="amount">{Math.round(provider.uptime / 3600) || 0}h</p>
                <p className="subtext">Since {new Date(provider.onlineAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="action-buttons">
              {provider.status === 'setup' && (
                <button
                  className="btn btn-primary"
                  onClick={handleGoOnline}
                  disabled={goingOnline}
                >
                  {goingOnline ? '⏳ Going Online...' : '🚀 Go Online'}
                </button>
              )}
              {provider.status === 'online' && (
                <button className="btn btn-secondary" onClick={handleGoOffline}>
                  ⏹️ Go Offline
                </button>
              )}
            </div>

            {earnings.records.length > 0 && (
              <div className="earnings-chart">
                <h3>📊 Earnings History (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={earnings.records
                      .slice(0, 7)
                      .reverse()
                      .map((e, i) => ({
                        name: new Date(e.createdAt).toLocaleDateString(),
                        earnings: e.amount,
                      }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="earnings" fill="#10b981" name="SCT Earned" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <div className="tab-content">
            <h2>📈 Earning History</h2>
            {earnings.records.length === 0 ? (
              <p className="empty-state">No earnings yet. Go online and start earning!</p>
            ) : (
              <table className="earnings-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount (SCT)</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.records.map((earning, idx) => (
                    <tr key={idx}>
                      <td>{new Date(earning.createdAt).toLocaleDateString()}</td>
                      <td className="type-badge">{earning.type}</td>
                      <td className="amount-green">+{earning.amount.toFixed(4)}</td>
                      <td>{earning.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Device Info Tab */}
        {activeTab === 'device' && (
          <div className="tab-content">
            <h2>🖥️ Device Information</h2>
            <div className="device-grid">
              <div className="device-card">
                <h4>💻 Device</h4>
                <p>
                  <strong>Hostname:</strong> {provider.device?.hostname || 'N/A'}
                </p>
                <p>
                  <strong>Platform:</strong> {provider.device?.platform || 'N/A'}
                </p>
                <p>
                  <strong>CPU Cores:</strong> {provider.device?.cpus || 'N/A'}
                </p>
              </div>

              <div className="device-card">
                <h4>🌐 Network</h4>
                <p>
                  <strong>IP Address:</strong> {provider.device?.ip || 'N/A'}
                </p>
                <p>
                  <strong>Wallet:</strong> {provider.wallet || 'Not set'}
                </p>
              </div>

              <div className="device-card">
                <h4>💾 Memory</h4>
                <p>
                  <strong>Total:</strong> {provider.device?.memory?.totalMB}  MB
                </p>
                <p>
                  <strong>Free:</strong> {provider.device?.memory?.freeMB} MB
                </p>
              </div>

              <div className="device-card">
                <h4>📀 Storage</h4>
                <p>
                  <strong>Total:</strong> {provider.hdd?.totalGB} GB
                </p>
                <p>
                  <strong>Used:</strong> {provider.hdd?.usedGB} GB
                </p>
                <p>
                  <strong>Free:</strong> {provider.hdd?.freeGB} GB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Withdrawal Tab */}
        {activeTab === 'withdraw' && <WithdrawalTab providerId={providerId} balance={balance} />}
      </main>
    </div>
  );
}

// Withdrawal Component
function WithdrawalTab({ providerId, balance }) {
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/providers/cli/${providerId}/dashboard`);
      if (res.data.success) {
        setWithdrawals(res.data.withdrawals);
      }
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();

    if (!amount || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }

    if (amount > balance.available) {
      alert(`Insufficient balance. Available: ${balance.available.toFixed(4)} SCT`);
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/providers/cli/${providerId}/withdraw`, {
        amount: parseFloat(amount),
      });

      if (res.data.success) {
        alert(`✓ Withdrawal processed!\n\nTX: ${res.data.txHash}`);
        setAmount('');
        setWalletAddress('');
        fetchWithdrawals();
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="withdrawal-section">
      <h2>💸 Withdraw Tokens</h2>

      <div className="withdrawal-form-section">
        <div className="balance-info">
          <p>
            <strong>Available Balance:</strong> {balance.available.toFixed(4)} SCT
          </p>
          <p className="small">Total Earned: {balance.total.toFixed(4)} SCT | Withdrawn: {balance.withdrawn.toFixed(4)} SCT</p>
        </div>

        <form onSubmit={handleWithdraw} className="withdrawal-form">
          <div className="form-group">
            <label>Withdrawal Amount (SCT)</label>
            <input
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.000"
              max={balance.available}
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !amount}>
            {loading ? '⏳ Processing...' : '💸 Withdraw'}
          </button>
        </form>
      </div>

      {withdrawals.length > 0 && (
        <div className="withdrawal-history">
          <h3>📜 Withdrawal History</h3>
          <table className="withdrawals-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount (SCT)</th>
                <th>Status</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w, idx) => (
                <tr key={idx}>
                  <td>{new Date(w.createdAt).toLocaleDateString()}</td>
                  <td>{w.amount.toFixed(4)}</td>
                  <td>
                    <span className={`status-${w.status}`}>{w.status.toUpperCase()}</span>
                  </td>
                  <td>
                    {w.transactionHash ? (
                      <a href={`https://sepolia.etherscan.io/tx/${w.transactionHash}`} target="_blank" rel="noopener noreferrer">
                        {w.transactionHash.slice(0, 10)}...
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
