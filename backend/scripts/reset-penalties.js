const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config({ path: './backend/.env' });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const S = require('./backend/models/StorageListing');
  const r = await S.updateMany({}, {
    $set: { penaltyPoints: 0, penaltyHistory: [], integrityViolations: [], totalViolations: 0, reputationScore: 100 }
  });
  console.log('Reset done:', r.modifiedCount, 'providers');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
