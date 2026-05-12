const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const User = require('./models/User');
const StorageListing = require('./models/StorageListing');

mongoose.connect('mongodb+srv://miyurudilakshan_db_user:iyQyNqTo3rKdQery@storachain.m6nsjve.mongodb.net/?appName=StoraChain')
  .then(async () => {
    const user = await User.findOne({email: 'oshadirathnayaka3@gmail.com'});
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    const result = await StorageListing.deleteMany({providerId: { $ne: user._id }});
    console.log('Deleted dummy providers:', result.deletedCount);
    process.exit(0);
  });
