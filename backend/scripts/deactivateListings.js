require('dotenv').config();
const mongoose = require('mongoose');
const StorageListing = require('../models/StorageListing');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const res = await StorageListing.updateMany({}, { $set: { isActive: false } });
    console.log(JSON.stringify({ matched: res.matchedCount, modified: res.modifiedCount }, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
