const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const StorageListing = require('../backend/models/StorageListing');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  // Fix: set all providers with isActive=false to active
  const r1 = await StorageListing.updateMany({ isActive: { $ne: true } }, { $set: { isActive: true } });
  console.log('Fixed', r1.modifiedCount, 'inactive → active');
  // Also fix walletAddress not being set (empty string)
  const all = await StorageListing.find().select('isActive walletAddress agentUrl capacityGB');
  console.log('All providers:');
  all.forEach(p => console.log(' isActive:', p.isActive, '| agent:', p.agentUrl, '| wallet:', p.walletAddress?.slice(0, 10) || 'NONE', '| cap:', p.capacityGB, 'GB'));
  await mongoose.disconnect();
  console.log('Done');
}
fix().catch(e => { console.error(e.message); process.exit(1); });
