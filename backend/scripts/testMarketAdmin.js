const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const API = 'http://localhost:5000/api';

async function run() {
  const t = Date.now();
  const sellerEmail = `s${t}@ex.com`;
  const buyerEmail = `b${t}@ex.com`;
  const adminEmail = `a${t}@ex.com`;
  const pw = 'Passw0rd!123';

  console.log('Testing Marketplace & Admin flows...');
  
  await axios.post(`${API}/auth/register`, { name:'S', email:sellerEmail, password:pw, role:'seeker' });
  const { data: sLogin } = await axios.post(`${API}/auth/login`, { email:sellerEmail, password:pw });
  const sellerToken = sLogin.token;

  await axios.post(`${API}/auth/register`, { name:'B', email:buyerEmail, password:pw, role:'seeker' });
  const { data: bLogin } = await axios.post(`${API}/auth/login`, { email:buyerEmail, password:pw });
  const buyerToken = bLogin.token;

  await axios.post(`${API}/auth/register`, { name:'A', email:adminEmail, password:pw, role:'admin' });
  const { data: aLogin } = await axios.post(`${API}/auth/login`, { email:adminEmail, password:pw });
  const adminToken = aLogin.token;

  const tmpPath = path.resolve(__dirname, 'tmp.txt');
  fs.writeFileSync(tmpPath, 'hello world');
  const form = new FormData();
  form.append('file', fs.createReadStream(tmpPath));
  form.append('walletAddress', ethers.Wallet.createRandom().address);

  const uploadRes = await axios.post(`${API}/storage/upload`, form, {
    headers: { Authorization: `Bearer ${sellerToken}`, ...form.getHeaders() }
  });
  const fileId = uploadRes.data.fileId;
  
  // Wait a sec for processing
  await new Promise(r => setTimeout(r, 2000));
  
  // List it on marketplace
  await axios.post(`${API}/marketplace/list`, {
    fileRecordId: fileId,
    visibility: 'shared',
    title: 'Text file',
    priceSCT: 5,
    isLocked: true,
    singleSale: false
  }, { headers: { Authorization: `Bearer ${sellerToken}` } });

  await axios.patch(`${API}/storage/files/${fileId}/settings`, {
    visibility: 'shared',
    isLocked: true,
    priceSCT: 5,
  }, { headers: { Authorization: `Bearer ${sellerToken}` } });

  // Get shareToken
  const fileRes = await axios.get(`${API}/storage/files/${fileId}`, { headers: { Authorization: `Bearer ${sellerToken}` }});
  const shareToken = fileRes.data.shareToken;

  // Buy it
  await axios.post(`${API}/storage/public/${shareToken}/purchase`, { method: 'demo_sct' }, { headers: { Authorization: `Bearer ${buyerToken}` }});
  console.log('✓ Purchase successful using demo_sct');

  // Verify balances
  const bMe = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${buyerToken}` }});
  const sMe = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${sellerToken}` }});
  console.log('Buyer SCT:', bMe.data.sctBalance, 'Seller SCT:', sMe.data.sctBalance);

  // Admin routes
  await axios.get(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${adminToken}` }});
  console.log('✓ Admin stats OK');
  await axios.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${adminToken}` }});
  console.log('✓ Admin users OK');
  await axios.get(`${API}/admin/abuse-reports`, { headers: { Authorization: `Bearer ${adminToken}` }});
  console.log('✓ Admin abuse-reports OK');

  console.log('All remaining flows OK!');
}

run().catch(e => console.error(e?.response?.data || e.message));
