import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, Terminal, CheckCircle, AlertTriangle, ChevronDown,
  ChevronUp, HardDrive, WifiOff, Shield, Info,
} from 'lucide-react';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding: '22px 26px',
  marginBottom: 16,
};

const stepNum = (n, color = '#2997ff') => (
  <div style={{
    width: 30, height: 30, borderRadius: '50%',
    background: `${color}18`, border: `2px solid ${color}60`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.82rem', fontWeight: 800, color, flexShrink: 0,
  }}>{n}</div>
);

const codeBlock = (text) => (
  <div style={{
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '13px 18px', fontFamily: 'monospace',
    fontSize: '0.85rem', color: '#30d158', overflowX: 'auto', marginTop: 10,
    userSelect: 'all',
  }}>
    {text}
  </div>
);

function AccordionSection({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 24px', background: 'none', border: 'none',
          color: '#fff', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: '#2997ff' }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
        {open ? <ChevronUp size={16} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.4)" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 24px 22px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function UninstallGuide() {
  return (
    <div style={{ maxWidth: 760, position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,55,95,0.12)', border: '1px solid rgba(255,55,95,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={20} color="#ff375f" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0 }}>
              Provider Uninstall Guide
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.88rem' }}>
              Safe removal of the StoraChain provider agent from your machine
            </p>
          </div>
        </div>

        {/* Warning */}
        <div style={{
          display: 'flex', gap: 12, padding: '14px 18px',
          background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.25)',
          borderRadius: 12, marginTop: 16,
        }}>
          <AlertTriangle size={18} color="#ff9f0a" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            <strong style={{ color: '#ff9f0a' }}>Before uninstalling:</strong> Make sure you understand that
            all chunks stored on your machine will be <strong>permanently destroyed</strong>.
            StoraChain's replication system will automatically re-route affected seekers' files
            to other healthy providers. However, if you are the <em>only</em> copy of a chunk
            and the IPFS/S3 backups are also unavailable, that data may be unrecoverable.
          </div>
        </div>
      </div>

      {/* What happens on uninstall */}
      <AccordionSection title="What happens when you uninstall" icon={<Info size={18} />} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: <WifiOff size={14} color="#ff375f" />, text: 'Your node is immediately marked offline in the StoraChain backend.', color: '#ff375f' },
            { icon: <Trash2 size={14} color="#ff375f" />, text: 'All encrypted chunk data stored on your machine is securely wiped.', color: '#ff375f' },
            { icon: <HardDrive size={14} color="#30d158" />, text: 'The reserved disk space (your allocated GB) is fully released back to your OS.', color: '#30d158' },
            { icon: <Shield size={14} color="#2997ff" />, text: 'StoraChain\'s replication monitor detects missing chunks and redistributes them to other online providers automatically.', color: '#2997ff' },
            { icon: <CheckCircle size={14} color="#30d158" />, text: 'Your earned SCT tokens remain in your wallet — uninstalling does not affect your balance.', color: '#30d158' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: `${item.color}08`, border: `1px solid ${item.color}20`, borderRadius: 10 }}>
              <div style={{ marginTop: 1 }}>{item.icon}</div>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Step-by-step: Windows */}
      <AccordionSection title="Windows — Step-by-step uninstall" icon={<Terminal size={18} />} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(1)}
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>Open a terminal in the provider agent folder</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>
                Navigate to wherever you extracted/installed the StoraChain provider agent (e.g. <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: 4 }}>C:\StoraChain-Provider</code>).
              </div>
              {codeBlock('cd C:\\StoraChain-Provider')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(2)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>Run the built-in uninstall command</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
                This single command will: deactivate your node on the backend, destroy all stored chunks, and release your allocated disk quota.
              </div>
              {codeBlock('node agent.js --uninstall')}
              <div style={{ marginTop: 10, fontSize: '0.79rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                You will see confirmation messages as each step completes. The agent exits automatically when done.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(3)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>Delete the agent folder</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>
                After the uninstall command finishes, delete the entire agent directory.
              </div>
              {codeBlock('rmdir /s /q C:\\StoraChain-Provider')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(4, '#30d158')}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#30d158', fontSize: '0.9rem', marginBottom: 4 }}>Verify on the dashboard</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>
                Log back in to StoraChain and check your Provider Dashboard — your node should show as <strong style={{ color: '#ff375f' }}>Offline</strong> and your allocated storage should read 0 GB.
              </div>
            </div>
          </div>

        </div>
      </AccordionSection>

      {/* Step-by-step: Linux / macOS */}
      <AccordionSection title="Linux / macOS — Step-by-step uninstall" icon={<Terminal size={18} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(1)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>Stop the agent process</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>If running as a background service, stop it first:</div>
              {codeBlock('pkill -f "node agent.js"')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(2)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>Run the uninstall command</div>
              {codeBlock('node agent.js --uninstall')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(3)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>Remove the agent directory</div>
              {codeBlock('rm -rf ~/storachain-provider')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {stepNum(4)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>Remove Node.js (optional)</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>If Node.js was installed solely for the agent, you can remove it with your package manager:</div>
              {codeBlock('sudo apt remove nodejs   # Ubuntu/Debian\nbrew uninstall node       # macOS Homebrew')}
            </div>
          </div>

        </div>
      </AccordionSection>

      {/* Manual cleanup */}
      <AccordionSection title="Manual cleanup (if the uninstall command fails)" icon={<Shield size={18} />}>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 14 }}>
          If the agent crashes before finishing the uninstall, you may need to manually remove the vault and reservation file.
          The vault is stored in a system path (not inside your chosen storage folder) and the reservation file is on your drive root.
        </div>

        <div style={{ fontWeight: 700, color: '#ff9f0a', fontSize: '0.82rem', marginBottom: 8 }}>Windows</div>
        {codeBlock([
          ':: Remove vault (replace XXXX with your 8-char vault ID shown on agent startup)',
          'rmdir /s /q "%ProgramData%\\MicrosoftEdgeSvc_XXXX"',
          '',
          ':: Remove reservation file on your storage drive (e.g. D:)',
          'del /f /a:sh "D:\\.$svchost_XXXX.sys"',
          '',
          ':: Or use attrib to strip protection first',
          'attrib -r -s -h "D:\\.$svchost_XXXX.sys"',
          'del "D:\\.$svchost_XXXX.sys"',
        ].join('\n'))}

        <div style={{ fontWeight: 700, color: '#ff9f0a', fontSize: '0.82rem', margin: '16px 0 8px' }}>Linux / macOS</div>
        {codeBlock([
          '# Remove vault (replace XXXX with your 8-char vault ID)',
          'sudo rm -rf /var/cache/.svc_XXXX',
          '',
          '# Remove reservation file',
          'rm -f ~/storachain-storage/.storachain_reserve_XXXX',
        ].join('\n'))}
      </AccordionSection>

      {/* FAQ */}
      <AccordionSection title="Frequently asked questions" icon={<Info size={18} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            {
              q: 'Will seekers lose their files when I uninstall?',
              a: 'Not immediately. Every chunk is replicated to at least one other provider. StoraChain\'s hourly replication monitor detects missing replicas and re-distributes them to healthy providers. Seekers can also fall back to the Pinata IPFS backup or AWS S3 backup automatically.',
            },
            {
              q: 'What happens to my earned SCT tokens?',
              a: 'Your SCT tokens are on the StoraChain network. Uninstalling the agent has no effect on your wallet balance. You can withdraw your pending earnings from the Withdraw page before or after uninstalling.',
            },
            {
              q: 'Can I reinstall and continue earning?',
              a: 'Yes. You can register a new provider account or use the same account and re-register your node. StoraChain will assign new chunks to your node as seekers upload files.',
            },
            {
              q: 'I see my disk is still full after uninstalling. Why?',
              a: 'Run the uninstall command which explicitly releases the reservation file. If files remain, follow the manual cleanup steps above to find and delete the reservation file by its vault ID.',
            },
            {
              q: 'Why can\'t I see any StoraChain folders in my storage drive?',
              a: 'By design. The agent stores encrypted chunks as NTFS Alternate Data Streams on Windows (invisible to dir, dir /a, Explorer, WinRAR, and 7-Zip). The vault directory is placed in a system path (ProgramData), not inside your chosen storage folder. This protects data integrity and privacy.',
            },
          ].map((item, i) => (
            <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.87rem', marginBottom: 6 }}>{item.q}</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Support */}
      <div style={{ ...card, background: 'rgba(41,151,255,0.06)', border: '1px solid rgba(41,151,255,0.2)', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={16} color="#2997ff" />
          <span style={{ fontWeight: 700, color: '#2997ff', fontSize: '0.88rem' }}>Need help?</span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.83rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          If you encounter issues during uninstall, open a support ticket via the StoraChain admin panel
          or check the agent log output for error messages. The vault ID is printed at agent startup —
          keep a note of it if you ever need to do a manual cleanup.
        </p>
      </div>

    </div>
  );
}
