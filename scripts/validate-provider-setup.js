#!/usr/bin/env node
/**
 * StoraChain Provider System - Validation Checklist
 * Run this to verify all components are set up correctly
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║  StoraChain Provider System - Setup Verification     ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const checks = [];

// Check 1: Node.js version
console.log('📋 Checking prerequisites...\n');

const nodeVersion = process.version;
const nodeMajor = parseInt(nodeVersion.split('.')[0].substring(1));
checks.push({
  name: 'Node.js version',
  pass: nodeMajor >= 18,
  details: `${nodeVersion}`,
  message: nodeMajor >= 18 ? 'Node.js 18+ ✓' : 'ERROR: Node.js 18+ required',
});

// Check 2: Required files exist
const requiredFiles = [
  'backend/routes/providerRoutes.js',
  'backend/models/Provider.js',
  'backend/models/ProviderEarning.js',
  'backend/models/ProviderWithdrawal.js',
  'backend/abi/StoraToken.json',
  'frontend/src/pages/provider/ProviderDashboard.js',
  'frontend/src/pages/provider/ProviderSetup.js',
  'docs/PROVIDER_SETUP_GUIDE.md',
];

requiredFiles.forEach((file) => {
  const fullPath = path.join(__dirname, '..', file);
  const exists = fs.existsSync(fullPath);
  checks.push({
    name: `File: ${file}`,
    pass: exists,
    message: exists ? '✓' : 'MISSING',
  });
});

// Check 3: Environment variables
console.log('\n📋 Checking environment configuration...\n');

const envPath = path.join(__dirname, '..', 'backend', '.env');
const hasEnv = fs.existsSync(envPath);

if (hasEnv) {
  const env = fs.readFileSync(envPath, 'utf8');
  const hasSepoliaRPC = env.includes('SEPOLIA_RPC_URL');
  const hasPrivateKey = env.includes('PRIVATE_KEY');
  const hasTokenAddress = env.includes('STORATOKEN_ADDRESS') || env.includes('TOKEN_CONTRACT_ADDRESS');

  checks.push({
    name: '.env file',
    pass: true,
    message: '✓ Found',
  });

  checks.push({
    name: 'SEPOLIA_RPC_URL',
    pass: hasSepoliaRPC,
    message: hasSepoliaRPC ? '✓' : 'MISSING (needed for token minting)',
  });

  checks.push({
    name: 'PRIVATE_KEY',
    pass: hasPrivateKey,
    message: hasPrivateKey ? '✓' : 'MISSING (needed for token transfers)',
  });

  checks.push({
    name: 'STORATOKEN_ADDRESS',
    pass: hasTokenAddress,
    message: hasTokenAddress ? '✓' : 'MISSING (needed for token contract)',
  });
} else {
  checks.push({
    name: '.env file',
    pass: false,
    message: 'MISSING (copy from .env.example and configure)',
  });
}

// Check 4: npm packages
console.log('📋 Checking npm packages...\n');

const packages = ['express', 'mongoose', 'ethers', 'axios', 'react', 'react-router-dom'];
packages.forEach((pkg) => {
  try {
    require.resolve(pkg);
    checks.push({
      name: `Package: ${pkg}`,
      pass: true,
      message: '✓',
    });
  } catch (e) {
    checks.push({
      name: `Package: ${pkg}`,
      pass: false,
      message: 'MISSING (run npm install)',
    });
  }
});

// Print results
console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║                   VERIFICATION RESULTS                 ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

let passCount = 0;
let failCount = 0;

checks.forEach((check) => {
  const status = check.pass ? '✓' : '✗';
  const color = check.pass ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${color}${status}${reset} ${check.name}`);
  if (check.details) {
    console.log(`  └─ ${check.details}`);
  }
  if (check.message && !check.pass) {
    console.log(`  └─ ${check.message}`);
  }

  if (check.pass) passCount++;
  else failCount++;
});

console.log(`\n${passCount} passed, ${failCount} failed\n`);

// Summary
if (failCount === 0) {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   ✅ All checks passed! Ready for testing.            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('📝 Next steps:\n');
  console.log('1. Start the backend server:');
  console.log('   cd backend && npm start\n');

  console.log('2. Publish the CLI package (to npm):');
  console.log('   cd provider-installer && npm publish\n');

  console.log('3. Test installation:');
  console.log('   npm install -g storachain-provider');
  console.log('   storachain-provider\n');

  console.log('4. Access provider dashboard:');
  console.log('   https://storachain.app/provider\n');
} else {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   ⚠️  Please fix the issues above before testing.      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('📝 Common fixes:\n');
  console.log('1. Install dependencies:');
  console.log('   npm install\n');

  console.log('2. Configure environment:');
  console.log('   cp backend/.env.example backend/.env');
  console.log('   # Edit backend/.env with your Sepolia RPC URL and private key\n');

  console.log('3. Check Node.js version:');
  console.log('   node --version  # Must be v18+\n');

  console.log('4. Rebuild modules:');
  console.log('   rm -rf node_modules && npm install\n');

  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📚 Documentation:');
console.log('   → Provider Setup Guide: ./docs/PROVIDER_SETUP_GUIDE.md');
console.log('   → Architecture: ./docs/ARCHITECTURE.md');
console.log('   → Environment: ./backend/.env.example\n');
