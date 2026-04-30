const mongoose = require('mongoose');

const ProviderSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      // TODO: Hash in production
    },
    machineId: {
      type: String,
      required: true,
      unique: true,
    },
    deviceName: String,

    // Provider Status
    status: {
      type: String,
      enum: ['setup', 'online', 'offline', 'suspended'],
      default: 'setup',
    },

    // Wallet
    wallet: {
      address: {
        type: String,
        default: '',
      },
    },

    // HDD Storage
    hdd: {
      path: String,
      totalGB: {
        type: Number,
        default: 0,
      },
      freeGB: {
        type: Number,
        default: 0,
      },
      usedGB: {
        type: Number,
        default: 0,
      },
    },

    // Device Info
    device: {
      hostname: String,
      platform: String,
      cpus: Number,
      memory: {
        totalMB: Number,
        freeMB: Number,
      },
      ip: String,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    onlineAt: Date,
    offlineAt: Date,
    lastHeartbeat: Date,
    uptime: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Provider', ProviderSchema);
