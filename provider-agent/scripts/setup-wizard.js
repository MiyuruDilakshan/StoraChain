const readline = require('readline');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ── Parse --backend flag from CLI args ────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : defaultVal;
}

const BACKEND_URL = getArg('--backend', process.env.BACKEND_URL || 'https://api.storachain.miyuru.dev');

// ── Readline setup ────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Read password from stdin with masking (shows * for each character).
 * Works on Windows, Linux, and macOS.
 */
function hiddenQuestion(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    
    // If stdin is a TTY, use raw mode for character-by-character masking
    if (stdin.isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      let password = '';

      const onData = (ch) => {
        // Ctrl+C
        if (ch === '\u0003') {
          process.stdout.write('\n');
          process.exit(1);
        }
        // Enter
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(wasRaw || false);
          stdin.removeListener('data', onData);
          stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        // Backspace
        if (ch === '\u007f' || ch === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          return;
        }
        // Normal character
        password += ch;
        process.stdout.write('*');
      };
      stdin.on('data', onData);
    } else {
      // Non-TTY (piped input) — just read normally
      rl.question('', (answer) => {
        resolve(answer);
      });
    }
  });
}

// ── Smart OS detection ────────────────────────────────────────────
function getOSName() {
  const platform = os.platform();
  const release = os.release();

  if (platform === 'win32') {
    // Windows 11 has build number >= 22000
    const parts = release.split('.');
    const build = parseInt(parts[2] || '0', 10);
    if (build >= 22000) {
      return `Windows 11 (Build ${build})`;
    }
    // Windows 10
    return `Windows 10 (Build ${build})`;
  }

  if (platform === 'darwin') {
    try {
      const ver = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
      return `macOS ${ver}`;
    } catch {
      return `macOS ${release}`;
    }
  }

  if (platform === 'linux') {
    try {
      const prettyName = execSync('grep PRETTY_NAME /etc/os-release', { encoding: 'utf8' });
      const match = prettyName.match(/PRETTY_NAME="(.+)"/);
      if (match) return match[1];
    } catch { /* fallback */ }
    return `Linux ${release}`;
  }

  return `${os.type()} ${release}`;
}

function getSystemInfo() {
  const totalMemGB = (os.totalmem() / 1024 ** 3).toFixed(2);
  const freeMemGB = (os.freemem() / 1024 ** 3).toFixed(2);
  const cpus = os.cpus();
  return {
    os: getOSName(),
    cpu: cpus.length > 0 ? cpus[0].model : 'Unknown',
    cores: cpus.length,
    ram: `${freeMemGB} GB free / ${totalMemGB} GB total`
  };
}

// ── Main setup flow ───────────────────────────────────────────────
async function start() {
  console.log('\n======================================================');
  console.log('   StoraChain Provider Agent - Setup Wizard');
  console.log('======================================================\n');

  const sys = getSystemInfo();
  console.log('--- System Information ---');
  console.log(`OS    : ${sys.os}`);
  console.log(`CPU   : ${sys.cpu} (${sys.cores} cores)`);
  console.log(`RAM   : ${sys.ram}`);
  console.log(`API   : ${BACKEND_URL}`);
  console.log('--------------------------\n');

  // ── Login ─────────────────────────────────────────────────────
  console.log('Log in with your StoraChain account:\n');
  const email = await question('  Email    : ');
  const password = await hiddenQuestion('  Password : ');

  let jwtToken = '';
  let defaultWallet = '';
  try {
    console.log('\n  Authenticating...');
    const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
    jwtToken = res.data.token;
    defaultWallet = res.data.walletAddress || '';
    console.log('  ✅ Authentication successful!\n');
  } catch (err) {
    console.error('\n  ❌ Authentication failed:', err.response?.data?.message || err.message);
    console.log('  Please check your email/password and try again.\n');
    rl.close();
    process.exit(1);
  }

  // ── Node Settings (Deferred to Dashboard) ───────────────
  const space = '0';
  const wallet = defaultWallet;

  // ── Save .env ─────────────────────────────────────────────────
  console.log('\n  Saving configuration...');
  const envContent = `WALLET_ADDRESS=${wallet}
AGENT_JWT=${jwtToken}
BACKEND_URL=${BACKEND_URL}
BACKEND_AGENT_KEY=agent-secret-key
PRICE_PER_GB=1
REGION=local
STORAGE_DIR=./storachain-storage
SPACE_GB=${space}
`;
  fs.writeFileSync('.env', envContent);
  console.log('  ✓ Configuration saved.');

  // ── Start with PM2 ────────────────────────────────────────────
  console.log('  Setting up background service...');
  try {
    try {
      execSync('pm2 -v', { stdio: 'ignore' });
    } catch (e) {
      console.log('  Installing pm2 globally...');
      execSync('npm install -g pm2', { stdio: 'inherit' });
    }
    
    const startCmd = `pm2 start agent.js --name storachain-provider`;
    execSync(startCmd, { stdio: 'inherit' });
    
    try { execSync('pm2 save', { stdio: 'ignore' }); } catch(e){}

    console.log('\n======================================================');
    console.log('  ✅ SETUP COMPLETE! Provider Agent is running.');
    console.log('======================================================');
    console.log(`  Allocated Space : ${space} GB`);
    console.log(`  Wallet Address  : ${wallet || '(not set)'}`);
    console.log(`  Backend         : ${BACKEND_URL}`);
    console.log('\n  Monitor:  pm2 logs storachain-provider');
    console.log('  Status:   pm2 status');
    console.log('  Stop:     pm2 stop storachain-provider');
    console.log('======================================================\n');
    console.log('  ⚠️  IMPORTANT FOR VPS USERS:');
    console.log('  Your agent registered using your public IP.');
    console.log('  Make sure your VPS firewall allows TCP port 3001');
    console.log('  (or whichever port the agent is using) inbound.');
    console.log('======================================================\n');
  } catch (err) {
    console.error('  ❌ Failed to start background service:', err.message);
  }

  rl.close();
}

start();
