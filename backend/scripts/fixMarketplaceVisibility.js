/**
 * fixMarketplaceVisibility.js
 * Sets all marketplace-listed files to visibility: 'shared' so their share links work.
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const FileRecord = require('../models/FileRecord');
const MarketplaceListing = require('../models/MarketplaceListing');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const listings = await MarketplaceListing.find({ isActive: true });
  console.log('Active marketplace listings:', listings.length);

  let fixed = 0;
  for (const listing of listings) {
    if (listing.fileRecordId) {
      const result = await FileRecord.findByIdAndUpdate(
        listing.fileRecordId,
        { visibility: 'shared' },
        { new: true }
      );
      if (result) {
        fixed++;
        console.log(`  ✓ Fixed: ${result.fileName} → visibility: shared`);
      }
    }
  }
  console.log(`\nFixed ${fixed} files to visibility: 'shared'`);
  await mongoose.disconnect();
}

fix().catch(e => { console.error(e.message); process.exit(1); });
