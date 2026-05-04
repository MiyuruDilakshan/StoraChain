const readline = require('readline');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Function to securely read password (hides input)
function hiddenQuestion(query) {
  return new Promise(resolve => {
    rl.question(query, value => resolve(value));
    // Hacky way to hide password in readline, but standard rl.question works for basic usage.
  });
}

function getSystemInfo() {
  const totalMemGB = (os.totalmem() / 1024 ** 3).toFixed(2);
  const freeMemGB = (os.freemem() / 1024 ** 3).toFixed(2);
  const cpus = os.cpus();
  return {
    os: `${os.type()} ${os.release()}`,
    cpu: cpus.length > 0 ? cpus[0].model : 'Unknown',
    cores: cpus.length,
    ram: `${freeMemGB} GB free / ${totalMemGB} GB total`
  };
}

async function start() {
  console.log('\\n======================================================');
  console.log('   StoraChain Provider Agent - Automated Setup Wizard');
  console.log('======================================================\\n');

  const sys = getSystemInfo();
  console.log('--- System Information ---');
  console.log(`OS    : ${sys.os}`);
  console.log(`CPU   : ${sys.cpu} (${sys.cores} cores)`);
  console.log(`RAM   : ${sys.ram}`);
  console.log('--------------------------\\n');

  // Backend URL
  let backendUrl = await question('Backend API URL (Press Enter for http://localhost:5000): ');
  if (!backendUrl.trim()) backendUrl = 'http://localhost:5000';

  // Login
  console.log('\\nPlease log in with your StoraChain account:');
  const email = await question('Email: ');
  const password = await question('Password: ');

  let jwtToken = '';
  let defaultWallet = '';
  try {
    console.log('Authenticating...');
    const res = await axios.post(`${backendUrl}/api/auth/login`, { email, password });
    jwtToken = res.data.token;
    defaultWallet = res.data.walletAddress || '';
    console.log('✅ Authentication successful!\\n');
  } catch (err) {
    console.error('❌ Authentication failed:', err.response?.data?.message || err.message);
    console.log('Please run the setup again.');
    process.exit(1);
  }

  // Node Settings
  let space = await question('Disk space to allocate in GB (e.g., 20): ');
  if (!space || isNaN(space)) space = '10';

  let wallet = await question(`Wallet Address (Optional, press Enter for ${defaultWallet || 'none'}): `);
  if (!wallet.trim()) wallet = defaultWallet;

  // Create .env
  console.log('\\nSaving configuration...');
  const envContent = `WALLET_ADDRESS=${wallet}
AGENT_JWT=${jwtToken}
BACKEND_URL=${backendUrl}
BACKEND_AGENT_KEY=agent-secret-key
PRICE_PER_GB=1
REGION=local
STORAGE_DIR=./storachain-storage
`;
  fs.writeFileSync('.env', envContent);

  // Install PM2 to run in background
  console.log('Setting up background service using PM2...');
  try {
    // Check if pm2 is installed
    try {
      execSync('pm2 -v', { stdio: 'ignore' });
    } catch (e) {
      console.log('Installing pm2 globally...');
      execSync('npm install -g pm2', { stdio: 'inherit' });
    }
    
    // Start agent
    const startCmd = `pm2 start agent.js --name storachain-provider -- --space ${space} --wallet "${wallet}"`;
    execSync(startCmd, { stdio: 'inherit' });
    
    // Save PM2 process list
    try { execSync('pm2 save', { stdio: 'ignore' }); } catch(e){}

    console.log('\\n======================================================');
    console.log('  ✅ SETUP COMPLETE! Provider Agent is running.');
    console.log('======================================================');
    console.log(`  Allocated Space : ${space} GB`);
    console.log(`  Wallet Address  : ${wallet}`);
    console.log('\\nTo monitor your node, use these commands:');
    console.log('  pm2 logs storachain-provider');
    console.log('  pm2 status');
    console.log('\\nTo stop the node:');
    console.log('  pm2 stop storachain-provider');
    console.log('======================================================\\n');
  } catch (err) {
    console.error('❌ Failed to start background service:', err.message);
  }

  rl.close();
}

start();
