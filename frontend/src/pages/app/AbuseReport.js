import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Send, FileWarning, Image as ImageIcon, X } from 'lucide-react';
import api from '../../api/client';

export default function AbuseReport() {
  const [terms, setTerms] = useState(null);
  const [targetType, setTargetType] = useState('file');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceImageName, setEvidenceImageName] = useState('');
  const [evidenceImageDataUrl, setEvidenceImageDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/abuse/terms').then(r => setTerms(r.data)).catch(() => setTerms(null));
  }, []);

  const handleScreenshotChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Screenshot must be an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Screenshot must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEvidenceImageName(file.name);
      setEvidenceImageDataUrl(String(reader.result || ''));
      setErr('');
    };
    reader.onerror = () => setErr('Failed to read screenshot file.');
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setErr('');
    setMsg('');
    if (!reason.trim()) {
      setErr('Please describe the issue.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/abuse/report', {
        targetType,
        targetId: targetId.trim(),
        reason: reason.trim(),
        evidenceUrl: evidenceUrl.trim(),
        evidenceImageName,
        evidenceImageDataUrl,
      });
      setMsg('Report submitted. Our admin team will review it.');
      setReason('');
      setEvidenceUrl('');
      setTargetId('');
      setEvidenceImageName('');
      setEvidenceImageDataUrl('');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, position: 'relative', zIndex: 1 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>Safety & Abuse Reporting</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 8, fontSize: '0.92rem' }}>
          Report prohibited content, suspicious marketplace activity, or policy violations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FileWarning size={16} color="#ff9f0a" />
            <h3 style={{ margin: 0, color: '#fff', fontSize: '0.86rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Submit Report</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <select value={targetType} onChange={e => setTargetType(e.target.value)} style={inputStyle}>
              <option value="file" style={{ color: '#111' }}>File</option>
              <option value="listing" style={{ color: '#111' }}>Marketplace Listing</option>
              <option value="user" style={{ color: '#111' }}>User</option>
              <option value="provider" style={{ color: '#111' }}>Provider Node</option>
              <option value="other" style={{ color: '#111' }}>Other</option>
            </select>

            <input value={targetId} onChange={e => setTargetId(e.target.value)} placeholder="Target ID (optional)" style={inputStyle} />
            <input value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="Evidence URL (optional)" style={inputStyle} />

            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(41,151,255,0.3)', background: 'rgba(41,151,255,0.1)', color: '#2997ff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                <ImageIcon size={13} /> Attach Screenshot (optional)
                <input type="file" accept="image/*" onChange={handleScreenshotChange} style={{ display: 'none' }} />
              </label>
              {evidenceImageName && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evidenceImageName}</span>
                  <button onClick={() => { setEvidenceImageName(''); setEvidenceImageDataUrl(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={7} placeholder="Describe what happened and why it violates terms..." style={{ ...inputStyle, resize: 'vertical' }} />

            <button onClick={submit} disabled={loading}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,159,10,0.35)', background: 'rgba(255,159,10,0.12)', color: '#ff9f0a', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, width: 'fit-content' }}>
              <Send size={14} /> {loading ? 'Submitting...' : 'Submit Report'}
            </button>

            {msg && <div style={{ color: '#30d158', fontSize: '0.83rem', fontWeight: 600 }}>{msg}</div>}
            {err && <div style={{ color: '#ff375f', fontSize: '0.83rem', fontWeight: 600 }}>{err}</div>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldAlert size={16} color="#2997ff" />
            <h3 style={{ margin: 0, color: '#fff', fontSize: '0.86rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Terms Snapshot</h3>
          </div>

          {(terms?.bullets || []).length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.6)', fontSize: '0.84rem', lineHeight: 1.8 }}>
              {terms.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.84rem' }}>Terms are currently unavailable.</div>
          )}

          <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.76rem' }}>
            Updated: {terms?.updatedAt || 'N/A'}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  color: '#fff',
  padding: '10px 12px',
  fontSize: '0.86rem',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  appearance: 'none',
  WebkitAppearance: 'none',
  colorScheme: 'dark',
};
