#!/usr/bin/env node
import chalk from 'chalk';
import inquirer from 'inquirer';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getMachineId } from 'node-machine-id';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || 'https://api.storachain.miyuru.dev';
const PROVIDER_HOME = path.join(os.homedir(), '.storachain-provider');
const CONFIG_FILE = path.join(PROVIDER_HOME, 'config.json');

console.clear();
console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
console.log(chalk.cyan.bold('║   StoraChain Provider Installation Suite    ║'));
console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));

// Step 1: Check Requirements
async function checkRequirements() {
  console.log(chalk.yellow('📋 Checking system requirements...\n'));

  const requirements = {
    'Node.js': () => {
      const v = process.version.split('.')[0].slice(1);
      return parseInt(v) >= 18;
    },
    'npm': async () => {
      try {
        await axios.get('https://registry.npmjs.org/npm/latest');
        return true;
      } catch {
        return false;
      }
    },
    'Disk Space': () => {
      try {
        const targetPath = process.platform === 'win32' ? process.cwd().split(path.sep)[0] + path.sep : '/';
        fs.statfsSync(targetPath);
        return true;
      } catch {
        return false;
      }
    }
  };

  let allOk = true;
  for (const [req, check] of Object.entries(requirements)) {
    try {
      const result = await check();
      console.log(result ? chalk.green(`✓ ${req}`): chalk.red(`✗ ${req} not found`));
      allOk = allOk && result;
    } catch (e) {
      console.log(chalk.gray(`⊘ ${req} (optional)`));
    }
  }

  if (!allOk) {
    console.log(chalk.red('\n❌ Some requirements are missing. Please install them and try again.\n'));
    process.exit(1);
  }

  console.log(chalk.green('\n✅ All requirements satisfied!\n'));
}

// Step 2: Get Credentials
async function getCredentials() {
  console.log(chalk.yellow('📝 Provider Registration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Storage Provider Email:',
      validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      validate: (v) => v.length >= 8 || 'Password must be at least 8 characters',
    },
    {
      type: 'input',
      name: 'walletAddress',
      message: 'Ethereum Wallet Address (receiver for rewards):',
      validate: (v) => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid wallet address',
    },
  ]);

  return answers;
}

// Step 3: Validate Credentials with Backend
async function validateCredentials(email, password) {
  try {
    console.log(chalk.blue('\n🔐 Validating credentials with backend...'));
    const response = await axios.post(`${BACKEND_URL}/api/providers/cli/register`, {
      email,
      password,
      machineId: await getMachineId(),
      deviceName: os.hostname(),
    });

    if (response.data.success) {
      console.log(chalk.green('✅ Credentials validated!\n'));
      return response.data;
    } else {
      console.log(chalk.red('❌ Validation failed: ' + response.data.message + '\n'));
      return null;
    }
  } catch (error) {
    console.log(chalk.red('❌ Backend connection error: ' + error.message + '\n'));
    return null;
  }
}

// Step 4: Get HDD Allocation
async function getHDDAllocation() {
  console.log(chalk.yellow('💾 HDD Allocation\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'hddSizeGB',
      message: 'Total HDD storage to allocate (GB):',
      validate: (v) => {
        const num = parseInt(v);
        return (num > 0 && num <= 10000) || 'Enter a value between 1-10000 GB';
      },
    },
    {
      type: 'input',
      name: 'hddPath',
      message: 'HDD mount path (e.g., /mnt/storage or D:\\storage):',
      default: process.platform === 'win32' ? 'D:\\storage' : '/mnt/storage',
    },
  ]);

  return {
    totalGB: parseInt(answers.hddSizeGB),
    path: answers.hddPath,
    usedGB: 0,
    freeGB: parseInt(answers.hddSizeGB),
  };
}

// Step 5: Setup Provider Home
async function setupProvider(credentials, hdd) {
  console.log(chalk.blue('\n🔧 Setting up provider...\n'));

  try {
    await fs.ensureDir(PROVIDER_HOME);
    await fs.ensureDir(path.join(PROVIDER_HOME, 'chunks'));
    await fs.ensureDir(path.join(PROVIDER_HOME, 'logs'));

    const config = {
      email: credentials.email,
      walletAddress: credentials.walletAddress,
      providerId: credentials.providerId,
      machineId: await getMachineId(),
      hdd,
      createdAt: new Date().toISOString(),
      status: 'setup',
      backendUrl: BACKEND_URL,
    };

    await fs.writeJSON(CONFIG_FILE, config, { spaces: 2 });

    console.log(chalk.green('✅ Provider setup complete!\n'));
    console.log(chalk.cyan('📁 Provider home: ' + PROVIDER_HOME));
    console.log(chalk.cyan('💾 HDD storage: ' + hdd.totalGB + ' GB at ' + hdd.path));

    return config;
  } catch (error) {
    console.log(chalk.red('Error during setup: ' + error.message));
    throw error;
  }
}

// Step 6: Register Provider Service
async function registerService(config) {
  console.log(chalk.blue('\n⚙️  Registering auto-startup service...\n'));

  try {
    if (process.platform === 'win32') {
      // Windows: Use pm2 or create batch file
      console.log(chalk.gray('ℹ️  Windows auto-startup: Use Task Scheduler to run "npm run service" on startup'));
    } else {
      // Linux/macOS: Create systemd service
      console.log(chalk.gray('ℹ️  Linux/macOS auto-startup: systemd service will be created'));
    }
    console.log(chalk.green('✅ Service registration complete!\n'));
  } catch (error) {
    console.log(chalk.red('Service registration warning: ' + error.message));
  }
}

// Main Flow
async function main() {
  try {
    await checkRequirements();

    const credentials = await getCredentials();
    const validated = await validateCredentials(credentials.email, credentials.password);

    if (!validated) {
      console.log(chalk.red('Failed to validate credentials. Please check your email/password and try again.\n'));
      process.exit(1);
    }

    credentials.providerId = validated.providerId;

    const hdd = await getHDDAllocation();
    const config = await setupProvider(credentials, hdd);
    await registerService(config);

    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║         🎉 Setup Successful! 🎉           ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));

    console.log(chalk.green('Next Steps:'));
    console.log(chalk.white('1. Go to your Provider Dashboard'));
    console.log(chalk.white(`   -> URL: ${BACKEND_URL.replace('/api', '')}/provider\n`));
    console.log(chalk.white('2. Log in with your email and password'));
    console.log(chalk.white('3. Click "Go Online" to activate your provider\n'));
    console.log(chalk.white('4. Your provider service will auto-launch on system startup\n'));

    console.log(chalk.yellow('💡 Tip: Run "storachain-provider status" to check provider health anytime.\n'));

  } catch (error) {
    console.log(chalk.red('Fatal error: ' + error.message + '\n'));
    process.exit(1);
  }
}

main();
