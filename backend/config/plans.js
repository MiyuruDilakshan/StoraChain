const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    storageGB: 2,
    maxUploadMB: 100,
    priceUSD: 0,
    priceSCT: 0,
    demoUSD: 50,
    demoSCT: 100,
    description: 'Get started with decentralized storage',
    features: [
      '2 GB storage quota',
      'Up to 100 MB per upload',
      'AES-256-GCM encryption',
      '4-tier redundant retrieval',
      '$50 demo USD + 100 demo SCT for testing',
      'Provider rewards subsidized by platform',
    ],
    highlight: false,
    badge: null,
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    storageGB: 50,
    maxUploadMB: 1024,
    priceUSD: 5,
    priceSCT: 100,
    demoUSD: 0,
    demoSCT: 0,
    description: 'For individuals who need more space',
    features: [
      '50 GB storage quota',
      'Up to 1 GB per upload',
      'AES-256-GCM encryption',
      '4-tier redundant retrieval',
      'Priority provider matching',
      'IPFS + S3 backup',
    ],
    highlight: false,
    badge: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    storageGB: 200,
    maxUploadMB: 5120,
    priceUSD: 15,
    priceSCT: 300,
    demoUSD: 0,
    demoSCT: 0,
    description: 'For power users and small teams',
    features: [
      '200 GB storage quota',
      'Up to 5 GB per upload',
      'AES-256-GCM encryption',
      '4-tier redundant retrieval',
      'Analytics dashboard',
      'Faster replication speed',
      'On-chain file records',
    ],
    highlight: true,
    badge: 'Most Popular',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    storageGB: 1024,
    maxUploadMB: 20480,
    priceUSD: 50,
    priceSCT: 1000,
    demoUSD: 0,
    demoSCT: 0,
    description: 'For businesses with high-volume needs',
    features: [
      '1 TB storage quota',
      'Up to 20 GB per upload',
      'AES-256-GCM encryption',
      '4-tier redundant retrieval',
      'Dedicated provider slots',
      'Custom SLA guarantee',
      'Priority support',
    ],
    highlight: false,
    badge: null,
  },
};

// Revenue distribution: applied when a paid plan payment is received
const REVENUE_SPLIT = {
  providers:       0.70,  // 70% → distributed to active storage providers
  platformReserve: 0.20,  // 20% → platform reserve fund
  infrastructure:  0.10,  // 10% → backup + infrastructure costs
};

module.exports = { PLANS, REVENUE_SPLIT };
