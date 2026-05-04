'use strict';
const readline = require('readline');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BACKEND_URL = 'https://storachain.io/api'; // production
// For local dev, override: set STORACHAIN_BACKEND env var
const BACKEND = process.env.STORACHAIN_BACKEND || 'http://localhost:5000';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let pw = '';
    const onData = (ch) => {
      if (ch === '\n' || ch === '\r' || ch === '\u0003') {
        if (stdin.setRawMode) stdin.setRawMode(wasRaw || false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(pw);
      } else if (ch === '\u007f') {
        if (pw.length > 0) { pw = pw.slice(0, -1); process.stdout.write('\b \b'); }
      } else { pw += ch; process.stdout.write('*'); }
    };
    stdin.on('data', onData);
  });
}

function cpuInfo() {
  const c = os.cpus();
  return { os: `${os.type()} ${os.release()}`, cpu: c[0]?.model || 'Unknown', cores: c.length };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     StoraChain Provider Agent Installer      ║');
  console.log('║           Run as Administrator               ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const sys = cpuInfo();
  console.log(`  OS   : ${sys.os}`);
  console.log(`  CPU  : ${sys.cpu} (${sys.cores} cores)`);
  console.log(`  Node : ${process.version}\n`);

  console.log('Please sign in with your StoraChain provider account:\n');
  const email    = await ask('  Email    : ');
  const password = process.stdin.isTTY
    ? await askHidden('  Password : ')
    : await ask('  Password : ');

  // Authenticate
  let token = '';
  process.stdout.write('\n  Authenticating...');
  try {
    const res = await axios.post(`${BACKEND}/api/auth/login`, { email, password }, { timeout: 10000 });
    token = res.data.token;
    console.log(' ✓ Logged in!\n');
  } catch (err) {
    console.error('\n  ✗ Login failed:', err.response?.data?.message || err.message);
    console.log('\n  Please check your email and password and try again.');
    rl.close(); process.exit(1);
  }

  // Save .env (no wallet or space — those are configured from dashboard)
  const envContent = [
    `AGENT_JWT=${token}`,
    `BACKEND_URL=${BACKEND}`,
    `BACKEND_AGENT_KEY=agent-secret-key`,
    `REGION=local`,
    `STORAGE_DIR=./storachain-storage`,
  ].join('\n') + '\n';

  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, envContent);
  console.log('  ✓ Configuration saved.\n');

  // Install pm2 if needed
  try {
    try { execSync('pm2 -v', { stdio: 'ignore' }); }
    catch { console.log('  Installing pm2...'); execSync('npm install -g pm2', { stdio: 'inherit' }); }

    // Start agent with minimal args — wallet & space set from dashboard
    execSync('pm2 delete storachain-provider 2>nul || true', { stdio: 'ignore', shell: true });
    execSync(`pm2 start "${path.join(process.cwd(), 'agent.js')}" --name storachain-provider`, { stdio: 'inherit', shell: true });
    execSync('pm2 save', { stdio: 'ignore' });

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║        ✓  SETUP COMPLETE!                    ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Your provider agent is running in the       ║');
    console.log('║  background and is registered with the       ║');
    console.log('║  StoraChain network.                         ║');
    console.log('║                                              ║');
    console.log('║  NEXT STEPS:                                 ║');
    console.log('║  1. Go to: http://localhost:3000/login       ║');
    console.log('║  2. Log in with your provider credentials    ║');
    console.log('║  3. Click "My Storage Node" in the sidebar   ║');
    console.log('║  4. Select your disk, set storage size       ║');
    console.log('║     and enter your wallet address            ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Useful commands:                            ║');
    console.log('║    pm2 logs storachain-provider              ║');
    console.log('║    pm2 status                                ║');
    console.log('║    pm2 stop storachain-provider              ║');
    console.log('╚══════════════════════════════════════════════╝\n');
  } catch (err) {
    console.error('  ✗ Failed to start background service:', err.message);
    console.log('\n  You can start it manually: node agent.js');
  }
  rl.close();
}

main();
