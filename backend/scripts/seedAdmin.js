/**
 * seedAdmin.js - Creates a default admin account for StoraChain
 */
const axios = require('axios');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const API = 'http://localhost:5000/api';
const SECRET = process.env.ADMIN_SECRET || 'StoraChain-Admin-2024';

async function run() {
  console.log('--- Seeding Admin Account ---');
  try {
    const res = await axios.post(`${API}/auth/admin-register`, {
      name: 'StoraChain Administrator',
      email: 'admin@storachain.io',
      password: 'AdminPassword123!',
      adminSecret: SECRET
    });
    console.log('Success:', res.data.message);
  } catch (err) {
    if (err.response?.data?.message?.includes('already registered')) {
      console.log('Admin account admin@storachain.io already exists.');
    } else {
      console.error('Error:', err.response?.data || err.message);
    }
  }
}

run();
