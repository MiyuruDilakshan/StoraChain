# StoraChain

StoraChain is a final-year project that combines a React frontend, a Node.js/Express backend, and a Solidity smart contract for a decentralized storage-oriented application.

The current repository contains three working areas:

- `backend/` for authentication and database access
- `frontend/` for the public site, login, registration, and dashboard UI
- `smart-contracts/` for the Ethereum storage registry contract and deployment scripts

## Project Overview

The backend currently exposes authentication APIs for registering and logging in users. It connects to MongoDB through Mongoose, hashes passwords with bcrypt, and issues JWTs for authenticated sessions.

The frontend is a single-page React application with routes for the landing page, registration, login, and dashboard. It stores the login token and user profile in local storage and uses axios to call the backend authentication endpoints.

The smart-contract project contains a Solidity contract named `StoraChainStorage`. It stores file metadata on-chain, including CID, filename, file size, timestamp, and uploader address. The contract supports file upload, listing the caller’s files, counting files, and deleting a stored file record. A Hardhat deployment script and Sepolia network configuration are included.

## Technologies Used

- React 19
- React Router
- Framer Motion
- Axios
- Lucide React icons
- Node.js
- Express
- MongoDB
- Mongoose
- bcryptjs
- JSON Web Token (JWT)
- Solidity `0.8.20`
- Hardhat
- Ethers via Hardhat toolbox

## Current Progress

What is implemented now:

- Backend server startup, JSON/body parsing, CORS, and MongoDB connection setup
- User model with name, email, password, role, and createdAt fields
- Registration and login routes with password hashing and JWT generation
- React landing page, login page, registration page, and dashboard page
- Frontend authentication flow that saves token and user data in local storage
- Solidity contract for storing and deleting file metadata records
- Hardhat config for Sepolia deployment and a deploy script for `StoraChainStorage`

What is not yet present in the codebase:

- No file upload workflow connected between the frontend, backend, and smart contract
- No file storage or IPFS integration in the backend or frontend code shown here
- No protected backend routes beyond authentication
- No automated tests included in the current package scripts
- No production deployment configuration in the repository root

## Repository Structure

- `backend/server.js` starts the API server
- `backend/config/db.js` connects to MongoDB
- `backend/models/User.js` defines the user schema
- `backend/routes/authRoutes.js` handles register and login
- `frontend/src/App.js` defines the app routes
- `frontend/src/pages/` contains the landing, auth, and dashboard screens
- `smart-contracts/contracts/StoraChainStorage.sol` contains the storage registry contract
- `smart-contracts/scripts/deploy.js` deploys the contract with Hardhat

## Next Steps to Complete the Project

Based on the current implementation and typical requirements for a decentralized storage platform, here is a detailed step-by-step guide to build out the full project. This assumes the goal is to create a working file upload and storage system where users can upload files to IPFS, record metadata on the blockchain, and manage their files through the UI. Each step includes specific file paths, code changes, and commands.

### Phase 1: Integrate IPFS for Decentralized File Storage

1. **Install IPFS Dependencies**
   - In `smart-contracts/package.json`, add IPFS libraries (but since smart contracts don't interact directly, this is for backend).
   - In `backend/package.json`, add `ipfs-http-client` for Node.js IPFS integration.
   - Run: `cd backend && npm install ipfs-http-client`

2. **Set Up IPFS Node or Use Infura/Pinata**
   - For development, use a hosted IPFS service like Pinata or Infura to avoid running a local IPFS node.
   - Create an account on Pinata (pinata.cloud) and get API keys.
   - Add to `backend/.env`: `PINATA_API_KEY=your_key`, `PINATA_SECRET_API_KEY=your_secret`

3. **Create IPFS Upload Utility in Backend**
   - Create `backend/utils/ipfs.js`:
     ```javascript
     const { create } = require('ipfs-http-client');
     const pinataSDK = require('@pinata/sdk');
     const pinata = pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

     async function uploadToIPFS(fileBuffer, fileName) {
       const result = await pinata.pinFileToIPFS(fileBuffer, { pinataMetadata: { name: fileName } });
       return result.IpfsHash;
     }

     module.exports = { uploadToIPFS };
     ```
   - Install `@pinata/sdk` in backend: `npm install @pinata/sdk`

### Phase 2: Add File Upload API in Backend

1. **Create File Model**
   - In `backend/models/File.js`:
     ```javascript
     const mongoose = require('mongoose');

     const fileSchema = new mongoose.Schema({
       cid: { type: String, required: true },
       fileName: { type: String, required: true },
       fileSize: { type: Number, required: true },
       uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
       uploadedAt: { type: Date, default: Date.now }
     });

     module.exports = mongoose.model('File', fileSchema);
     ```

2. **Add File Upload Route**
   - In `backend/routes/fileRoutes.js`:
     ```javascript
     const express = require('express');
     const multer = require('multer');
     const { uploadToIPFS } = require('../utils/ipfs');
     const File = require('../models/File');
     const auth = require('../middleware/auth'); // You'll need to create this

     const router = express.Router();
     const upload = multer({ storage: multer.memoryStorage() });

     router.post('/upload', auth, upload.single('file'), async (req, res) => {
       try {
         const cid = await uploadToIPFS(req.file.buffer, req.file.originalname);
         const file = new File({
           cid,
           fileName: req.file.originalname,
           fileSize: req.file.size,
           uploadedBy: req.user.id
         });
         await file.save();
         res.json({ cid, fileName: req.file.originalname, fileSize: req.file.size });
       } catch (error) {
         res.status(500).json({ message: 'Upload failed' });
       }
     });

     module.exports = router;
     ```
   - Install multer: `npm install multer`
   - Create `backend/middleware/auth.js` for JWT verification:
     ```javascript
     const jwt = require('jsonwebtoken');

     module.exports = (req, res, next) => {
       const token = req.header('Authorization')?.replace('Bearer ', '');
       if (!token) return res.status(401).json({ message: 'No token' });
       try {
         req.user = jwt.verify(token, process.env.JWT_SECRET);
         next();
       } catch (error) {
         res.status(401).json({ message: 'Invalid token' });
       }
     };
     ```

3. **Update Server.js to Include File Routes**
   - In `backend/server.js`, add: `app.use('/api/files', require('./routes/fileRoutes'));`

### Phase 3: Integrate Smart Contract with Backend

1. **Install Ethers in Backend**
   - `cd backend && npm install ethers`

2. **Create Contract Interaction Utility**
   - In `backend/utils/contract.js`:
     ```javascript
     const ethers = require('ethers');
     const StoraChainStorage = require('../artifacts/contracts/StoraChainStorage.sol/StoraChainStorage.json'); // Copy from smart-contracts

     const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
     const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
     const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, StoraChainStorage.abi, wallet);

     async function recordFileOnChain(cid, fileName, fileSize, uploaderAddress) {
       const tx = await contract.uploadFile(cid, fileName, fileSize);
       await tx.wait();
       return tx.hash;
     }

     module.exports = { recordFileOnChain };
     ```
   - Copy `smart-contracts/artifacts/contracts/StoraChainStorage.sol/StoraChainStorage.json` to `backend/artifacts/`
   - Add to `backend/.env`: `CONTRACT_ADDRESS=deployed_address`, `SEPOLIA_RPC_URL=`, `PRIVATE_KEY=`

3. **Update File Upload Route to Call Contract**
   - In `backend/routes/fileRoutes.js`, after saving to DB, add:
     ```javascript
     const { recordFileOnChain } = require('../utils/contract');
     // After file.save()
     await recordFileOnChain(cid, req.file.originalname, req.file.size, req.user.id);
     ```

### Phase 4: Update Frontend for File Upload

1. **Add File Upload Component**
   - In `frontend/src/components/`, create `FileUpload.js`:
     ```javascript
     import React, { useState } from 'react';
     import axios from 'axios';

     const FileUpload = () => {
       const [file, setFile] = useState(null);

       const handleUpload = async () => {
         const formData = new FormData();
         formData.append('file', file);
         const token = localStorage.getItem('token');
         await axios.post('http://localhost:5000/api/files/upload', formData, {
           headers: { Authorization: `Bearer ${token}` }
         });
       };

       return (
         <div>
           <input type="file" onChange={(e) => setFile(e.target.files[0])} />
           <button onClick={handleUpload}>Upload</button>
         </div>
       );
     };

     export default FileUpload;
     ```

2. **Integrate into Dashboard**
   - In `frontend/src/pages/Dashboard.js`, import and add `<FileUpload />` in the main content.

3. **Fetch and Display User's Files**
   - Add a state for files, fetch from backend (you'll need a new API endpoint for that).
   - Create `backend/routes/fileRoutes.js` GET route for user's files.

### Phase 5: Add File Management Features

1. **Add Delete Functionality**
   - In `frontend/src/pages/Dashboard.js`, add delete buttons that call a backend delete API.
   - In `backend/routes/fileRoutes.js`, add DELETE route that calls contract.deleteFile().

2. **Update Dashboard UI**
   - Modify `Dashboard.js` to show a list of files with CID, name, size, and actions.

### Phase 6: Testing and Deployment

1. **Add Tests**
   - Use Jest for backend: `npm install --save-dev jest supertest`
   - Add test scripts in `backend/package.json`.

2. **Deploy Backend**
   - Use Heroku or similar for backend deployment.

3. **Deploy Frontend**
   - Build and deploy to Netlify or Vercel: `npm run build` in frontend.

4. **Deploy Smart Contract**
   - Run `npx hardhat run scripts/deploy.js --network sepolia` to deploy.

### Additional Considerations

- **Security**: Add input validation, rate limiting.
- **Error Handling**: Improve error messages in all components.
- **UI/UX**: Enhance the dashboard with better file management UI.
- **Scalability**: Consider pagination for file lists.
- **Documentation**: Update this README with setup instructions.

This guide provides a complete path from the current state to a functional decentralized storage app. Each step builds on the existing code without assuming unverified features.
