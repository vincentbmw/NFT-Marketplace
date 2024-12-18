# NFT Marketplace on Aptos

<div align="center">
  <img src="frontend/public/Aptos_Primary_WHT.png" alt="Aptos NFT Marketplace" width="300"/>
  
  <p>A decentralized NFT marketplace built on the Aptos blockchain with React, TypeScript and Move</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Aptos](https://img.shields.io/badge/Aptos-000000?style=flat&logo=aptos&logoColor=white)](https://aptoslabs.com/)
  [![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
</div>

## 📝 Table of Contents

- [About](#about)
- [Features](#features) 
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installing Aptos CLI](#installing-aptos-cli)
    - [Windows Installation](#windows-installation)
    - [Mac Installation](#mac-installation)
  - [Installation](#installation)
- [Project Structure](#project-structure)
- [Smart Contract](#smart-contract)
- [Frontend](#frontend)

## About

This NFT Marketplace is a decentralized application (dApp) built on the Aptos blockchain. It provides a platform for users to mint, buy, sell, and auction NFTs with different rarity levels. The project showcases the integration of Move smart contracts with a modern React frontend.

## Features

- 🖼️ **NFT Management**
  - Mint new NFTs with customizable properties
  - List NFTs for sale with custom pricing
  - Transfer NFTs between users
  - View NFT details
  - Cancel NFT listings

- 🛍️ **Marketplace Features**
  - Browse NFTs by rarity
  - Purchase NFTs directly
  - Real-time price updates
  - Secure wallet integration
  - Marketplace fee system (2%)

- 🏷️ **Rarity System**
  - Common
  - Uncommon
  - Rare
  - Super Rare / Epic

- 🔨 **Auction System**
  - Create timed auctions
  - Place bids on active auctions
  - Automatic auction settlement
  - Real-time bidding updates
  - Time-based auction status
  - Real-time countdown timer

- 🔒 **Security Features**
  - Transaction verification
  - Smart contract access control
  - Secure wallet connection
  - Input validation
  - Error handling for failed transactions
  - Prevention of self-trading
  - Auction manipulation prevention
  - Duplicate NFT prevention

## Tech Stack

- **Blockchain**
  - [Aptos](https://aptoslabs.com/) - Layer 1 blockchain
  - [Move](https://move-language.github.io/move/) - Smart contract language
  - [Petra Wallet](https://petra.app/) - Aptos wallet

- **Frontend**
  - [React](https://reactjs.org/) - UI framework
  - [TypeScript](https://www.typescriptlang.org/) - Programming language
  - [Ant Design](https://ant.design/) - UI component library
  - [React Router](https://reactrouter.com/) - Navigation

## Getting Started

### Prerequisites

- Node.js v16+ 📦
- Aptos CLI 🛠️
- Petra Wallet 👛

### Installing Aptos CLI

#### Windows Installation 🪟

##### Install via Python Script

1. **Ensure you have Python 3.6+ installed by running**```bash
python3 --version
```
If python3 is not installed, you can find installation instructions on [python.org](https://python.org).

2. **In PowerShell, run the install script:**
```powershell
Invoke-WebRequest -Uri "https://aptos.dev/scripts/install_cli.py" -OutFile "$env:TEMP\install_cli.py"; python "$env:TEMP\install_cli.py"
```

> ⚠️ **Note**: If you receive the error `ModuleNotFoundError: No module named packaging`, you can install it by running:
> ```bash
> pip3 install packaging
> ```
> Then repeat this step.

3. **Copy and run the command to update your PATH from the terminal.**
It should look something like:
```bash
setx PATH "%PATH%;C:\Users\<your_account_name>\.aptoscli\bin"
```

4. **Verify the script is installed by opening a new terminal and running:**
```bash
aptos info
```
You should see a list of commands you can run using the CLI.

#### Mac Installation 🍎

For Mac, the easiest way to install the Aptos CLI is with the package manager `brew`.

1. **Ensure you have `brew` installed** [https://brew.sh/](https://brew.sh/).

2. **Open a new terminal and enter the following commands:**
```bash
brew update
brew install aptos
```

3. **Open another terminal and run `aptos help` to verify the CLI is installed.**
```bash
aptos help
```

> ⚠️ **Note**: If `brew` does not work for you, you can try the steps here: [Install Specific Aptos CLI Versions (Advanced)](https://aptos.dev/en/build/cli/install-cli/install-cli-specific-version)

### Installation

1. **Clone the Repository**
```bash
git clone https://github.com/vincentbmw/NFT-Marketplace.git
cd aptos-nft-marketplace
```

2. **Install Frontend dependencies**
```bash
# Install frontend dependencies
cd frontend
npm install
```

3. **Configure Environment**
```bash
# Create .env file in frontend directory
cp .env.example .env

# Update environment variables
REACT_APP_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
REACT_APP_APTOS_NETWORK=devnet
```

4. **Start Development Server**
```bash
npm run dev
```

## Project Structure

```
aptos-nft-marketplace/
├── backend/
│   └── contracts/
│       └── sources/
│           └── NFTMarketplace.move    # Smart contract
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/                # Reusable components
│       ├── pages/                     # Page components
│       ├── App.tsx                    # Main app component
│       └── index.tsx                  # Entry point
└── README.md
```

## Smart Contract

The NFT Marketplace smart contract is written in Move and includes:

- NFT minting and management
- Marketplace functionality
- Auction system
- Security features

Key contract functions:
```move
public entry fun mint_nft()           # Mint new NFT
public entry fun list_for_sale()      # List NFT for sale
public entry fun create_auction()      # Create NFT auction
public entry fun place_bid()          # Place bid on auction
```

## Frontend

The frontend is built with React and includes:

- Responsive design
- Real-time updates
- Wallet integration
- User-friendly interface

Key features:
- NFT gallery with filters
- Auction management
- User dashboard
- Transaction history

## Acknowledgments

- Aptos Labs for the blockchain platform
- Move language developers
- React and TypeScript communities
