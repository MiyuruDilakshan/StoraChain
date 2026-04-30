import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './ProviderSetup.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ProviderSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState('welcome'); // welcome, download, login, dashboard
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Just verify the provider exists by attempting dashboard fetch
      // In production, you'd have a actual login endpoint
      const res = await axios.get(`${API_URL}/api/providers/cli/${email}/dashboard`);

      if (res.data.success) {
        localStorage.setItem('providerId', email);
        localStorage.setItem('providerEmail', email);
        navigate('/provider/dashboard');
      }
    } catch (err) {
      setError('Provider not found or login failed. Make sure you\'ve run the installer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="provider-setup">
      <div className="setup-container">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="setup-step welcome-step">
            <div className="setup-icon">📦</div>
            <h1>Welcome to StoraChain Provider!</h1>
            <p>Join our decentralized storage network and start earning tokens.</p>

            <div className="setup-features">
              <div className="feature">
                <div className="feature-icon">💰</div>
                <h3>Earn Tokens</h3>
                <p>Get paid for storing and serving files</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🚀</div>
                <h3>Easy Setup</h3>
                <p>Download, run installer, start earning</p>
              </div>
              <div className="feature">
                <div className="feature-icon">📊</div>
                <h3>Monitor</h3>
                <p>Track earnings and device status</p>
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => setStep('download')}>
              Get Started →
            </button>
          </div>
        )}

        {/* Download Step */}
        {step === 'download' && (
          <div className="setup-step download-step">
            <div className="setup-icon">⬇️</div>
            <h1>Step 1: Download & Install</h1>
            <p>Download the StoraChain Provider service on your computer.</p>

            <div className="installation-options">
              <div className="install-option">
                <h3>Windows / macOS / Linux</h3>
                <p>Install via npm (requires Node.js 18+)</p>
                <code>npm install -g storachain-provider</code>
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText('npm install -g storachain-provider');
                    alert('Copied to clipboard!');
                  }}
                >
                  📋 Copy
                </button>
              </div>

              <div className="install-option">
                <h3>Run Installer</h3>
                <p>Launch the interactive setup wizard</p>
                <code>storachain-provider</code>
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText('storachain-provider');
                    alert('Copied to clipboard!');
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>

            <div className="setup-checklist">
              <h3>What the installer does:</h3>
              <ul>
                <li>✓ Checks system requirements</li>
                <li>✓ Asks for email and password</li>
                <li>✓ Configures HDD storage allocation</li>
                <li>✓ Registers with backend system</li>
                <li>✓ Sets up auto-startup service</li>
              </ul>
            </div>

            <div className="setup-buttons">
              <button className="btn btn-secondary" onClick={() => setStep('welcome')}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={() => setStep('login')}>
                Next: Login →
              </button>
            </div>
          </div>
        )}

        {/* Login Step */}
        {step === 'login' && (
          <div className="setup-step login-step">
            <div className="setup-icon">🔐</div>
            <h1>Step 2: Provider Login</h1>
            <p>Enter the email you used during installation.</p>

            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label>Provider Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={loading}
                  required
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? '⏳ Logging in...' : 'Access Dashboard →'}
              </button>
            </form>

            <p className="login-hint">
              💡 Make sure the StoraChain Provider service is running on your computer.
            </p>

            <div className="setup-buttons">
              <button className="btn btn-secondary" onClick={() => setStep('download')}>
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Info */}
      <div className="setup-side-info">
        <h3>📱 Provider Workflow</h3>
        <div className="workflow">
          <div className={`workflow-step ${['welcome', 'download', 'login'].includes(step) ? 'active' : 'done'}`}>
            <div className="step-number">1</div>
            <p>Download & Install</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className={`workflow-step ${step === 'login' ? 'active' : step === 'download' ? 'pending' : 'done'}`}>
            <div className="step-number">2</div>
            <p>Login</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className={`workflow-step ${step === 'dashboard' ? 'active' : 'pending'}`}>
            <div className="step-number">3</div>
            <p>Go Online</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step pending">
            <div className="step-number">4</div>
            <p>Earn Tokens!</p>
          </div>
        </div>

        <div className="faq">
          <h3>❓ FAQ</h3>
          <div className="faq-item">
            <h4>What's the registration bonus?</h4>
            <p>Get 0.1 SCT immediately, plus 0.2 SCT when you go online.</p>
          </div>
          <div className="faq-item">
            <h4>How do I go online?</h4>
            <p>Click "Go Online" in your dashboard and provide your wallet address.</p>
          </div>
          <div className="faq-item">
            <h4>Can I withdraw my earnings?</h4>
            <p>Yes! Visit the Withdraw tab to transfer SCT tokens to any wallet.</p>
          </div>
          <div className="faq-item">
            <h4>Do I need to keep my computer on?</h4>
            <p>The service runs in background. Restart your computer and it auto-launches.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
