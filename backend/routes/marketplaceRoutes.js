const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const fs   = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const MarketplaceListing = require('../models/MarketplaceListing');
const Transaction = require('../models/Transaction');
const FileAccess  = require('../models/FileAccess');
const FileRecord  = require('../models/FileRecord');
const User = require('../models/User');

// Helper: human-readable category from MIME type
function categoryFromMime(mime = '') {
  if (mime.startsWith('image/'))  return 'Media';
  if (mime.startsWith('video/'))  return 'Media';
  if (mime.startsWith('audio/'))  return 'Media';
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text/')) return 'Documents';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz')) return 'Archives';
  if (mime.includes('javascript') || mime.includes('python') || mime.includes('code')) return 'Software';
  return 'Data';
}

// ─── GET /api/marketplace ──────────────────────────────────────────────────
// List active listings with optional search/filter
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort = 'newest', page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (minPrice) filter.priceSCT = { $gte: Number(minPrice) };
    if (maxPrice) filter.priceSCT = { ...filter.priceSCT, $lte: Number(maxPrice) };
    if (search)   filter.$or = [
      { title:       { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { fileName:    { $regex: search, $options: 'i' } },
    ];

    const sortMap = {
      newest:    { createdAt: -1 },
      oldest:    { createdAt: 1 },
      cheapest:  { priceSCT: 1 },
      expensive: { priceSCT: -1 },
      popular:   { downloads: -1 },
    };

    const listings = await MarketplaceListing.find(filter)
      .populate('sellerId', 'name avatarColor role')
      .populate('fileRecordId', 'previewCid previewType shareToken visibility isLocked')
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await MarketplaceListing.countDocuments(filter);

    res.json({ listings, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[Marketplace] List error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/marketplace/mine ────────────────────────────────────────────
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const listings = await MarketplaceListing.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/marketplace/purchases ───────────────────────────────────────
router.get('/purchases', authMiddleware, async (req, res) => {
  try {
    const purchases = await Transaction.find({ buyerId: req.user.id, status: 'completed' })
      .populate('listingId', 'title fileName fileSize cid mimeType category')
      .populate('sellerId', 'name')
      .sort({ createdAt: -1 });
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/marketplace/shared-with-me ──────────────────────────────────
// Returns all files that have been shared with or purchased by the current user
router.get('/shared-with-me', authMiddleware, async (req, res) => {
  try {
    const accesses = await FileAccess.find({ buyerUserId: req.user.id, isActive: true })
      .populate('fileRecordId', 'fileName fileSize mimeType ipfsCid onChainTxHash cloudBackupPath')
      .populate('sellerUserId', 'name walletAddress')
      .sort({ grantedAt: -1 });
    res.json(accesses);
  } catch (err) {
    console.error('[Marketplace] shared-with-me error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/marketplace/list ────────────────────────────────────────────
router.post('/list', authMiddleware, async (req, res) => {
  try {
    const { fileRecordId, title, description, priceSCT, priceUSD, priceUSDCents,
            acceptsFiat, category, tags, isPrivate, targetWalletAddress } = req.body;
    if (!fileRecordId || !title) {
      return res.status(400).json({ message: 'fileRecordId and title are required' });
    }

    const fileRecord = await FileRecord.findOne({ _id: fileRecordId, userId: req.user.id, isDeleted: false });
    if (!fileRecord) return res.status(404).json({ message: 'File not found or not yours' });

    if (isPrivate) {
      if (!targetWalletAddress) return res.status(400).json({ message: 'targetWalletAddress required for private share' });
      const target = await User.findOne({ walletAddress: targetWalletAddress.toLowerCase() })
        || await User.findOne({ walletAddress: targetWalletAddress });
      if (!target) return res.status(404).json({ message: 'No user found with that wallet address' });
      if (target._id.toString() === req.user.id) return res.status(400).json({ message: 'Cannot share with yourself' });
      const existing = await FileAccess.findOne({ buyerUserId: target._id, fileRecordId: fileRecord._id, isActive: true });
      if (existing) return res.status(400).json({ message: 'File already shared with this user' });
      const access = await FileAccess.create({
        buyerUserId: target._id, sellerUserId: req.user.id, fileRecordId: fileRecord._id,
        grantedAt: new Date(), accessType: 'share', isActive: true,
      });
      return res.json({ message: 'File shared successfully', accessId: access._id, isPrivate: true });
    }

    const alreadyListed = await MarketplaceListing.findOne({ fileRecordId: fileRecord._id, sellerId: req.user.id, isActive: true });
    if (alreadyListed) return res.status(400).json({ message: 'Already listed on the marketplace' });

    const resolvedPriceUSDCents = priceUSDCents
      ? Number(priceUSDCents)
      : priceUSD ? Math.round(Number(priceUSD) * 100) : 0;

    const listing = new MarketplaceListing({
      sellerId:      req.user.id,
      fileRecordId:  fileRecord._id,
      title:         title.trim(),
      description:   description?.trim() || '',
      fileName:      fileRecord.fileName,
      fileSize:      fileRecord.fileSize || 0,
      mimeType:      fileRecord.mimeType || 'application/octet-stream',
      cid:           fileRecord.ipfsCid || 'pending',
      category:      category || categoryFromMime(fileRecord.mimeType),
      tags:          Array.isArray(tags) ? tags : (tags ? [tags] : []),
      priceSCT:      Math.max(0, Number(priceSCT) || 0),
      priceUSDCents: resolvedPriceUSDCents,
      acceptsTokens: true,
      acceptsFiat:   acceptsFiat === true || resolvedPriceUSDCents > 0,
    });
    await listing.save();

    // Mirror marketplace metadata back to the FileRecord + set visibility to 'shared'
    await FileRecord.findByIdAndUpdate(fileRecord._id, {
      marketplaceTitle:    title.trim(),
      marketplaceDesc:     description?.trim() || '',
      marketplaceCategory: category || categoryFromMime(fileRecord.mimeType),
      visibility:          'shared',  // make share link accessible
    });

    res.status(201).json({ message: 'Listing created', listing, isPrivate: false });
  } catch (err) {
    console.error('[Marketplace] List error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── GET /api/marketplace/:id ─────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id)
      .populate('sellerId', 'name avatarColor role createdAt');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    // Increment view count
    listing.views = (listing.views || 0) + 1;
    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/marketplace/create ─────────────────────────────────────────
// Create a new listing (seller provides CID of file already on IPFS)
router.post('/create', authMiddleware, async (req, res) => {
  const { title, description, fileName, fileSize, mimeType, cid, priceSCT, priceUSDCents, acceptsTokens, acceptsFiat, tags } = req.body;

  if (!title || !fileName || !cid) {
    return res.status(400).json({ message: 'title, fileName, and cid are required' });
  }
  if (!acceptsTokens && !acceptsFiat) {
    return res.status(400).json({ message: 'At least one payment method must be enabled' });
  }

  try {
    const listing = new MarketplaceListing({
      sellerId:      req.user.id,
      title:         title.trim(),
      description:   description?.trim() || '',
      fileName,
      fileSize:      fileSize || 0,
      mimeType:      mimeType || 'application/octet-stream',
      cid,
      category:      categoryFromMime(mimeType),
      tags:          Array.isArray(tags) ? tags : (tags ? [tags] : []),
      priceSCT:      Number(priceSCT) || 0,
      priceUSDCents: Number(priceUSDCents) || 0,
      acceptsTokens: acceptsTokens !== false,
      acceptsFiat:   acceptsFiat === true,
    });
    await listing.save();
    res.status(201).json({ message: 'Listing created', listing });
  } catch (err) {
    console.error('[Marketplace] Create error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE /api/marketplace/:id ──────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const listing = await MarketplaceListing.findOne({ _id: req.params.id, sellerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found or not yours' });
    listing.isActive = false;
    await listing.save();
    res.json({ message: 'Listing removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/marketplace/:id/purchase/token ─────────────────────────────
// Buy a listing using SCT tokens (off-chain balance). Also handles free (0 SCT) listings.
router.post('/:id/purchase/token', authMiddleware, async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id);
    if (!listing || !listing.isActive) return res.status(404).json({ message: 'Listing not found' });
    if (listing.sellerId.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot buy your own listing' });
    }

    const price = listing.priceSCT || 0;
    const isFree = price === 0;

    // Check not already purchased
    const existing = await Transaction.findOne({ buyerId: req.user.id, listingId: listing._id, status: 'completed' });
    if (existing) return res.status(400).json({ message: 'Already purchased' });

    // Check existing FileAccess
    const existingAccessCheck = await FileAccess.findOne({ buyerUserId: req.user.id, listingId: listing._id, isActive: true });
    if (existingAccessCheck) return res.status(400).json({ message: 'Already have access' });

    const buyer = await User.findById(req.user.id);
    if (!isFree) {
      if ((buyer.sctBalance || 0) < price) {
        return res.status(400).json({ message: `Insufficient SCT balance. Need ${price} SCT, have ${buyer.sctBalance || 0}` });
      }
      // Deduct from buyer
      buyer.sctBalance = (buyer.sctBalance || 0) - price;
      await buyer.save();

      // Credit seller
      const seller = await User.findById(listing.sellerId);
      if (seller) {
        seller.sctBalance = (seller.sctBalance || 0) + price;
        await seller.save();
      }
    }

    // Record transaction
    const tx = new Transaction({
      buyerId:         req.user.id,
      sellerId:        listing.sellerId,
      listingId:       listing._id,
      paymentMethod:   'token',
      amountSCT:       price,
      status:          'completed',
      downloadGranted: true,
    });
    await tx.save();

    listing.downloads = (listing.downloads || 0) + 1;
    if (listing.singleSale && !isFree) listing.isActive = false;
    await listing.save();

    // Grant FileAccess so buyer can download via the normal download route
    const linkedFile = listing.fileRecordId
      ? await FileRecord.findById(listing.fileRecordId)
      : await FileRecord.findOne({ ipfsCid: listing.cid, isDeleted: false });

    const access = await FileAccess.create({
      buyerUserId:  req.user.id,
      sellerUserId: listing.sellerId,
      fileRecordId: linkedFile?._id || null,
      listingId:    listing._id,
      grantedAt:    new Date(),
      accessType:   isFree ? 'free' : 'purchase',
      isActive:     true,
    });

    res.json({
      message:      isFree ? 'Access granted (free)' : 'Purchase successful',
      cid:          listing.cid,
      txId:         tx._id,
      accessId:     access._id,
      newBalance:   buyer.sctBalance,
      fileRecordId: linkedFile?._id || null,
      fileName:     listing.fileName,
    });
  } catch (err) {
    console.error('[Marketplace] Token purchase error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/marketplace/:id/purchase/demo-usd ─────────────────────────
router.post('/:id/purchase/demo-usd', authMiddleware, async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id);
    if (!listing || !listing.isActive) return res.status(404).json({ message: 'Listing not found' });
    if (listing.sellerId.toString() === req.user.id) return res.status(400).json({ message: 'Cannot buy your own listing' });

    const priceUSD = listing.priceUSDCents ? listing.priceUSDCents / 100 : 0;
    if (priceUSD <= 0) return res.status(400).json({ message: 'This listing has no USD price' });

    const buyer = await User.findById(req.user.id);
    if ((buyer.demoUSD || 0) < priceUSD) {
      return res.status(402).json({ message: `Insufficient Demo USD. Need $${priceUSD.toFixed(2)}, have $${(buyer.demoUSD || 0).toFixed(2)}` });
    }

    const existing = await FileAccess.findOne({ buyerUserId: req.user.id, listingId: listing._id, isActive: true });
    if (existing) return res.status(400).json({ message: 'Already purchased' });

    buyer.demoUSD = (buyer.demoUSD || 0) - priceUSD;
    await buyer.save();

    const seller = await User.findById(listing.sellerId);
    if (seller) { seller.demoUSD = (seller.demoUSD || 0) + priceUSD * 0.9; await seller.save(); }

    const linkedFile = listing.fileRecordId
      ? await FileRecord.findById(listing.fileRecordId)
      : await FileRecord.findOne({ ipfsCid: listing.cid, isDeleted: false });

    await FileAccess.create({
      buyerUserId: req.user.id, sellerUserId: listing.sellerId,
      fileRecordId: linkedFile?._id || null, listingId: listing._id,
      grantedAt: new Date(), accessType: 'purchase', isActive: true,
    });

    await Transaction.create({
      type: 'purchase', buyerId: req.user.id, sellerId: listing.sellerId,
      listingId: listing._id, paymentMethod: 'demo_usd',
      amountUSDCents: listing.priceUSDCents, status: 'completed', downloadGranted: true,
    });

    listing.downloads = (listing.downloads || 0) + 1;
    await listing.save();

    res.json({
      message:    'Purchase successful (Demo USD)',
      newBalance: buyer.demoUSD,
      fileRecordId: linkedFile?._id || null,
    });
  } catch (err) {
    console.error('[Marketplace] Demo USD purchase error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/marketplace/:id/purchase/stripe ────────────────────────────
// Create a Stripe PaymentIntent for fiat purchase
router.post('/:id/purchase/stripe', authMiddleware, async (req, res) => {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({ message: 'Stripe payments not configured on this server' });
  }

  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    const listing = await MarketplaceListing.findById(req.params.id);
    if (!listing || !listing.isActive) return res.status(404).json({ message: 'Listing not found' });
    if (!listing.acceptsFiat) return res.status(400).json({ message: 'This listing does not accept card payments' });
    if (listing.priceUSDCents < 50) return res.status(400).json({ message: 'Minimum Stripe charge is $0.50' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   listing.priceUSDCents,
      currency: 'usd',
      metadata: {
        listingId: listing._id.toString(),
        buyerId:   req.user.id,
        sellerId:  listing.sellerId.toString(),
      },
    });

    // Create a pending transaction record
    const tx = new Transaction({
      buyerId:               req.user.id,
      sellerId:              listing.sellerId,
      listingId:             listing._id,
      paymentMethod:         'stripe',
      amountUSDCents:        listing.priceUSDCents,
      stripePaymentIntentId: paymentIntent.id,
      status:                'pending',
    });
    await tx.save();

    res.json({ clientSecret: paymentIntent.client_secret, txId: tx._id });
  } catch (err) {
    console.error('[Marketplace] Stripe error:', err.message);
    res.status(500).json({ message: 'Stripe error', error: err.message });
  }
});

// ─── POST /api/marketplace/webhook ────────────────────────────────────────
// Stripe webhook — grant access after successful payment
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!STRIPE_SECRET_KEY) return res.sendStatus(200);

  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    const sig    = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET || '');
    } catch {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const tx = await Transaction.findOne({ stripePaymentIntentId: pi.id });
      if (tx) {
        tx.status = 'completed';
        tx.downloadGranted = true;
        await tx.save();
        const listing = await MarketplaceListing.findById(tx.listingId);
        if (listing) {
          listing.downloads = (listing.downloads || 0) + 1;
          await listing.save();
        }
        // Credit seller with SCT equivalent (optional)
        const seller = await User.findById(tx.sellerId);
        if (seller && listing) {
          seller.sctBalance = (seller.sctBalance || 0) + Math.floor(listing.priceSCT * 0.9);
          await seller.save();
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Marketplace] Webhook error:', err.message);
    res.sendStatus(500);
  }
});

// ─── POST /api/marketplace/purchase ───────────────────────────────────────
// On-chain SCT purchase using StoraToken.transferFrom
// Requires the buyer to have already called StoraToken.approve(backendWallet, amount)
// from their MetaMask, OR the route falls back to off-chain sctBalance accounting.
router.post('/purchase', authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.body;
    if (!listingId) return res.status(400).json({ message: 'listingId is required' });

    const listing = await MarketplaceListing.findById(listingId);
    if (!listing || !listing.isActive) {
      return res.status(404).json({ message: 'Listing not found or inactive' });
    }
    if (listing.sellerId.toString() === req.user.id) {
      return res.status(400).json({ message: 'Cannot purchase your own listing' });
    }

    // Prevent duplicate purchase
    const alreadyOwns = await FileAccess.findOne({
      buyerUserId:  req.user.id,
      listingId:    listing._id,
      isActive:     true,
    });
    if (alreadyOwns) return res.status(400).json({ message: 'Already purchased' });

    const buyer  = await User.findById(req.user.id);
    const seller = await User.findById(listing.sellerId);
    const price  = listing.priceSCT || 0;
    const fee    = Math.floor(price * 0.05);  // 5% platform fee
    const sellerAmount = price - fee;

    let txHash = '';

    // ── Attempt on-chain transferFrom ──────────────────────────────────────
    const RPC_URL    = process.env.SEPOLIA_RPC_URL        || '';
    const PRIV_KEY   = process.env.PRIVATE_KEY            || '';
    const TOKEN_ADDR = process.env.TOKEN_CONTRACT_ADDRESS || '';

    let onChainSuccess = false;
    if (RPC_URL && PRIV_KEY && TOKEN_ADDR && buyer?.walletAddress && price > 0) {
      try {
        let TOKEN_ABI;
        try {
          TOKEN_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/StoraToken.json'), 'utf8'));
        } catch {
          TOKEN_ABI = [
            'function balanceOf(address) view returns (uint256)',
            'function transferFrom(address from, address to, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)',
          ];
        }
        const provider     = new ethers.JsonRpcProvider(RPC_URL);
        const backendSigner = new ethers.Wallet(PRIV_KEY.replace(/^0x/, ''), provider);
        const token        = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, backendSigner);
        const decimals     = await token.decimals();

        // Check on-chain balance
        const balanceBN = await token.balanceOf(buyer.walletAddress);
        const priceBN   = ethers.parseUnits(String(price), decimals);
        if (balanceBN < priceBN) {
          return res.status(402).json({
            message: `Insufficient SCT balance. Need ${price} SCT.`,
            onChainBalance: ethers.formatUnits(balanceBN, decimals),
          });
        }

        const adminWallet  = await backendSigner.getAddress();
        const sellerWallet = seller?.walletAddress || adminWallet;

        // Transfer seller amount → seller
        const tx1 = await token.transferFrom(
          buyer.walletAddress,
          sellerWallet,
          ethers.parseUnits(String(sellerAmount), decimals)
        );
        await tx1.wait(1);
        txHash = tx1.hash;

        // Transfer fee → admin wallet (best-effort)
        if (fee > 0) {
          const tx2 = await token.transferFrom(
            buyer.walletAddress,
            adminWallet,
            ethers.parseUnits(String(fee), decimals)
          );
          await tx2.wait(1);
        }

        onChainSuccess = true;
      } catch (chainErr) {
        console.warn('[Marketplace] On-chain transferFrom failed (fallback to off-chain):', chainErr.message);
      }
    }

    // ── Off-chain balance fallback ─────────────────────────────────────────
    if (!onChainSuccess) {
      if ((buyer?.sctBalance || 0) < price) {
        return res.status(402).json({
          message: `Insufficient SCT balance. Need ${price} SCT, have ${buyer?.sctBalance || 0}`,
        });
      }
      if (buyer)  { buyer.sctBalance = (buyer.sctBalance || 0) - price; await buyer.save(); }
      if (seller) { seller.sctBalance = (seller.sctBalance || 0) + sellerAmount; await seller.save(); }
    }

    // Look up the FileRecord linked to this listing via CID match or fileRecordId
    let fileRecord = null;
    if (listing.fileRecordId) {
      fileRecord = await FileRecord.findById(listing.fileRecordId);
    }
    if (!fileRecord && listing.cid) {
      fileRecord = await FileRecord.findOne({ ipfsCid: listing.cid, isDeleted: false });
    }

    // Grant FileAccess
    const access = await FileAccess.create({
      buyerUserId:  req.user.id,
      sellerUserId: listing.sellerId,
      fileRecordId: fileRecord?._id || null,
      listingId:    listing._id,
      grantedAt:    new Date(),
      txHash,
      accessType:   'purchase',
      isActive:     true,
    });

    // Record transaction
    await Transaction.create({
      type:          'purchase',
      buyerId:       req.user.id,
      sellerId:      listing.sellerId,
      listingId:     listing._id,
      paymentMethod: 'token',
      amountSCT:     price,
      txHash,
      status:        'completed',
      downloadGranted: true,
    });

    // Increment download count; mark single-sale listing as sold
    listing.downloads = (listing.downloads || 0) + 1;
    if (listing.singleSale) listing.isActive = false;
    await listing.save();

    res.json({
      message:         'Purchase successful',
      txHash,
      onChain:         onChainSuccess,
      accessId:        access._id,
      fileRecordId:    fileRecord?._id || null,
      etherscanUrl:    txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : null,
    });
  } catch (err) {
    console.error('[Marketplace] Purchase error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── POST /api/marketplace/share ──────────────────────────────────────────
// Zero-cost private share: grants a specific wallet address access to a file
router.post('/share', authMiddleware, async (req, res) => {
  try {
    const { fileRecordId, targetWalletAddress } = req.body;
    if (!fileRecordId || !targetWalletAddress) {
      return res.status(400).json({ message: 'fileRecordId and targetWalletAddress are required' });
    }

    // Verify the sharer owns the file
    const fileRecord = await FileRecord.findOne({ _id: fileRecordId, userId: req.user.id, isDeleted: false });
    if (!fileRecord) return res.status(404).json({ message: 'File not found or not yours' });

    // Look up target user by wallet address
    const target = await User.findOne({ walletAddress: targetWalletAddress.toLowerCase() })
      || await User.findOne({ walletAddress: targetWalletAddress });
    if (!target) return res.status(404).json({ message: 'No user found with that wallet address' });
    if (target._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }

    // Prevent duplicate share
    const existing = await FileAccess.findOne({
      buyerUserId:  target._id,
      fileRecordId: fileRecord._id,
      isActive:     true,
    });
    if (existing) return res.status(400).json({ message: 'File already shared with this user' });

    const access = await FileAccess.create({
      buyerUserId:  target._id,
      sellerUserId: req.user.id,
      fileRecordId: fileRecord._id,
      grantedAt:    new Date(),
      accessType:   'share',
      isActive:     true,
    });

    res.json({
      message:    'File shared successfully',
      accessId:   access._id,
      sharedWith: { id: target._id, name: target.name, walletAddress: target.walletAddress },
    });
  } catch (err) {
    console.error('[Marketplace] Share error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
