const mongoose = require('mongoose');
require('dotenv').config();
const StorageListing = require('../models/StorageListing');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const r1 = await StorageListing.updateMany({ isActive: { $ne: true } }, { $set: { isActive: true } });
  console.log('Fixed', r1.modifiedCount, 'providers to active');
  const all = await StorageListing.find().select('isActive walletAddress agentUrl capacityGB');
  all.forEach(p => console.log(' active:', p.isActive, '| agent:', p.agentUrl, '| wallet:', p.walletAddress?.slice(0,10)||'NONE', '| cap:', p.capacityGB,'GB'));
  await mongoose.disconnect();
}
fix().catch(e => { console.error(e.message); process.exit(1); });
