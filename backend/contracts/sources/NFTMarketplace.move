module NFTMarketplace::nft_marketplace {
    use std::vector;
    use std::signer;
    use aptos_framework::timestamp;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::error;
    
    // Constants
    const MARKETPLACE_FEE_PERCENT: u64 = 2; // 2% marketplace fee
    
    // Error constants
    const EAUCTION_NOT_ACTIVE: u64 = 1000;
    const EAUCTION_ENDED: u64 = 1001;
    const EBID_TOO_LOW: u64 = 1002;
    const ESELLER_CANNOT_BID: u64 = 1003;
    const EINSUFFICIENT_FUNDS: u64 = 1004;
    
    // TODO# 2: Define NFT Structure
    struct NFT has store, key {
        id: u64,
        owner: address,
        name: vector<u8>,
        description: vector<u8>,
        uri: vector<u8>,
        price: u64,
        for_sale: bool,
        rarity: u8  // 1 for common, 2 for rare, 3 for epic, etc.
    }

    // TODO# 3: Define Marketplace Structure
    struct Marketplace has key {
        nfts: vector<NFT>,
        auctions: vector<Auction>
    }
    
    // TODO# 4: Define ListedNFT Structure
    struct ListedNFT has copy, drop {
        id: u64,
        price: u64,
        rarity: u8
    }

    // TODO# 6: Initialize Marketplace        
    public entry fun initialize(account: &signer) {
        let marketplace = Marketplace {
            nfts: vector::empty<NFT>(),
            auctions: vector::empty<Auction>()
        };
        move_to(account, marketplace);
    }

    // TODO# 7: Check Marketplace Initialization
    #[view]
    public fun is_marketplace_initialized(marketplace_addr: address): bool {
        exists<Marketplace>(marketplace_addr)
    }

    // TODO# 8: Mint New NFT
    public entry fun mint_nft(account: &signer, name: vector<u8>, description: vector<u8>, uri: vector<u8>, rarity: u8) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(signer::address_of(account));
        let nft_id = vector::length(&marketplace.nfts);

        let new_nft = NFT {
            id: nft_id,
            owner: signer::address_of(account),
            name,
            description,
            uri,
            price: 0,
            for_sale: false,
            rarity
        };

        vector::push_back(&mut marketplace.nfts, new_nft);
    }

    // TODO# 9: View NFT Details
    #[view]
    public fun get_nft_details(marketplace_addr: address, nft_id: u64): (u64, address, vector<u8>, vector<u8>, vector<u8>, u64, bool, u8) acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft = vector::borrow(&marketplace.nfts, nft_id);

        (
            nft.id,
            nft.owner,
            nft.name,
            nft.description,
            nft.uri,
            nft.price,
            nft.for_sale,
            nft.rarity
        )
    }
    
    // TODO# 10: List NFT for Sale
    public entry fun list_for_sale(account: &signer, marketplace_addr: address, nft_id: u64, price: u64) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.owner == signer::address_of(account), 100); // Caller is not the owner
        assert!(!nft_ref.for_sale, 101); // NFT is already listed
        assert!(price > 0, 102); // Invalid price

        nft_ref.for_sale = true;
        nft_ref.price = price;
    }

    // TODO# 11: Update NFT Price
    public entry fun set_price(account: &signer, marketplace_addr: address, nft_id: u64, price: u64) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.owner == signer::address_of(account), 200); // Caller is not the owner
        assert!(price > 0, 201); // Invalid price

        nft_ref.price = price;
    }
    
    // TODO# 12: Purchase NFT
    public entry fun purchase_nft(account: &signer, marketplace_addr: address, nft_id: u64, payment: u64) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.for_sale, 400); // NFT is not for sale
        assert!(payment >= nft_ref.price, 401); // Insufficient payment
        assert!(nft_ref.owner != signer::address_of(account), 402); // Cannot buy own NFT

        // Calculate marketplace fee
        let fee = (nft_ref.price * MARKETPLACE_FEE_PERCENT) / 100;
        let seller_revenue = payment - fee;

        // Transfer payment to the seller and fee to the marketplace
        coin::transfer<AptosCoin>(account, nft_ref.owner, seller_revenue);
        coin::transfer<AptosCoin>(account, marketplace_addr, fee);

        // Transfer ownership
        nft_ref.owner = signer::address_of(account);
        nft_ref.for_sale = false;
        nft_ref.price = 0;
    }

    // TODO# 13: Check if NFT is for Sale
    #[view]
    public fun is_nft_for_sale(marketplace_addr: address, nft_id: u64): bool acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft = vector::borrow(&marketplace.nfts, nft_id);
        nft.for_sale
    }

    // TODO# 14: Get NFT Price
    #[view]
    public fun get_nft_price(marketplace_addr: address, nft_id: u64): u64 acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft = vector::borrow(&marketplace.nfts, nft_id);
        nft.price
    }

    // TODO# 15: Transfer Ownership
    public entry fun transfer_ownership(account: &signer, marketplace_addr: address, nft_id: u64, new_owner: address) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.owner == signer::address_of(account), 300); // Caller is not the owner
        assert!(nft_ref.owner != new_owner, 301); // Prevent transfer to the same owner

        // Update NFT ownership and reset its for_sale status and price
        nft_ref.owner = new_owner;
        nft_ref.for_sale = false;
        nft_ref.price = 0;
    }

    // TODO# 16: Retrieve NFT Owner
    #[view]
    public fun get_owner(marketplace_addr: address, nft_id: u64): address acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft = vector::borrow(&marketplace.nfts, nft_id);
        nft.owner
    }

    // TODO# 17: Retrieve NFTs for Sale
    #[view]
    public fun get_all_nfts_for_owner(marketplace_addr: address, owner_addr: address, limit: u64, offset: u64): vector<u64> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft_ids = vector::empty<u64>();

        let nfts_len = vector::length(&marketplace.nfts);
        let end = min(offset + limit, nfts_len);
        let mut_i = offset;
        while (mut_i < end) {
            let nft = vector::borrow(&marketplace.nfts, mut_i);
            if (nft.owner == owner_addr) {
                vector::push_back(&mut nft_ids, nft.id);
            };
            mut_i = mut_i + 1;
        };

        nft_ids
    }


    // TODO# 18: Retrieve NFTs for Sale
    #[view]
    public fun get_all_nfts_for_sale(marketplace_addr: address, limit: u64, offset: u64): vector<ListedNFT> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nfts_for_sale = vector::empty<ListedNFT>();
        let mut_i = 0;
        let nfts_len = vector::length(&marketplace.nfts);

        while (mut_i < nfts_len) {
            let nft = vector::borrow(&marketplace.nfts, mut_i);
            if (nft.for_sale) {
                let listed_nft = ListedNFT {
                    id: nft.id,
                    price: nft.price,
                    rarity: nft.rarity
                };
                vector::push_back(&mut nfts_for_sale, listed_nft);
            };
            mut_i = mut_i + 1;
        };

        nfts_for_sale
    }

    // TODO# 19: Define Helper Function for Minimum Value
    // Helper function to find the minimum of two u64 numbers
    public fun min(a: u64, b: u64): u64 {
        if (a < b) { a } else { b }
    }

    // TODO# 20: Retrieve NFTs by Rarity
    // New function to retrieve NFTs by rarity
    #[view]
    public fun get_nfts_by_rarity(marketplace_addr: address, rarity: u8): vector<ListedNFT> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let result = vector::empty<ListedNFT>();
        let i = 0;
        while (i < vector::length(&marketplace.nfts)) {
            let nft = vector::borrow(&marketplace.nfts, i);
            if (nft.rarity == rarity && nft.for_sale) {
                let listed_nft = ListedNFT {
                    id: nft.id,
                    price: nft.price,
                    rarity: nft.rarity
                };
                vector::push_back(&mut result, listed_nft);
            };
            i = i + 1;
        };
        result
    }

    #[view]
    public fun get_nfts_by_price_range(marketplace_addr: address, min_price: u64, max_price: u64): vector<ListedNFT> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let result = vector::empty<ListedNFT>();
        let i = 0;
        while (i < vector::length(&marketplace.nfts)) {
            let nft = vector::borrow(&marketplace.nfts, i);
            if (nft.price >= min_price && nft.price <= max_price && nft.for_sale) {
                let listed_nft = ListedNFT {
                    id: nft.id,
                    price: nft.price,
                    rarity: nft.rarity
                };
                vector::push_back(&mut result, listed_nft);
            };
            i = i + 1;
        };
        result
    }

    // Auction structure
    struct Auction has store {
        nft_id: u64,
        seller: address,
        start_price: u64,
        current_price: u64,
        highest_bidder: address,
        end_time: u64,
        is_active: bool
    }

    // Auction functions
    public entry fun create_auction(
        account: &signer,
        marketplace_addr: address,
        nft_id: u64,
        start_price: u64,
        duration: u64
    ) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft = vector::borrow_mut(&mut marketplace.nfts, nft_id);
        assert!(nft.owner == signer::address_of(account), 1); // Only owner can create auction
        assert!(!nft.for_sale, 2); // NFT should not be listed for sale

        let auction = Auction {
            nft_id,
            seller: signer::address_of(account),
            start_price,
            current_price: start_price,
            highest_bidder: @0x0,
            end_time: timestamp::now_seconds() + duration,
            is_active: true
        };

        vector::push_back(&mut marketplace.auctions, auction);
        nft.for_sale = true;
    }

    public entry fun place_bid(
        account: &signer,
        marketplace_addr: address,
        auction_id: u64,
        bid_amount: u64
    ) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let auction = vector::borrow_mut(&mut marketplace.auctions, auction_id);
        let bidder_address = signer::address_of(account);
        
        // Basic validations
        assert!(auction.is_active, error::invalid_state(EAUCTION_NOT_ACTIVE));
        assert!(timestamp::now_seconds() < auction.end_time, error::invalid_state(EAUCTION_ENDED));
        assert!(bid_amount > auction.current_price, error::invalid_argument(EBID_TOO_LOW));
        assert!(bidder_address != auction.seller, error::invalid_argument(ESELLER_CANNOT_BID));

        // Check if bidder has enough balance
        assert!(coin::balance<AptosCoin>(bidder_address) >= bid_amount, 
            error::invalid_state(EINSUFFICIENT_FUNDS));

        // Return funds to previous highest bidder if exists
        if (auction.highest_bidder != @0x0) {
            coin::transfer<AptosCoin>(
                account,
                auction.highest_bidder,
                auction.current_price
            );
        };

        // Transfer new bid amount from bidder to marketplace
        coin::transfer<AptosCoin>(
            account,
            marketplace_addr,
            bid_amount
        );

        // Update auction state
        auction.highest_bidder = bidder_address;
        auction.current_price = bid_amount;
    }

    public entry fun end_auction(
        account: &signer,
        marketplace_addr: address,
        auction_id: u64
    ) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let auction = vector::borrow_mut(&mut marketplace.auctions, auction_id);
        
        assert!(auction.is_active, 1); // Auction must be active
        assert!(timestamp::now_seconds() >= auction.end_time, 2); // Auction must have ended

        // Transfer NFT to highest bidder
        let nft = vector::borrow_mut(&mut marketplace.nfts, auction.nft_id);
        nft.owner = auction.highest_bidder;
        nft.for_sale = false;

        // Calculate and transfer marketplace fee
        let fee_amount = (auction.current_price * MARKETPLACE_FEE_PERCENT) / 100;
        let seller_amount = auction.current_price - fee_amount;

        // Transfer funds
        coin::transfer<AptosCoin>(account, auction.seller, seller_amount);
        coin::transfer<AptosCoin>(account, marketplace_addr, fee_amount);

        // Close auction
        auction.is_active = false;
    }

    #[view]
    public fun get_auction_details(marketplace_addr: address, auction_id: u64): (u64, address, u64, u64, address, u64, bool) acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let auction = vector::borrow(&marketplace.auctions, auction_id);
        
        (
            auction.nft_id,
            auction.seller,
            auction.start_price,
            auction.current_price,
            auction.highest_bidder,
            auction.end_time,
            auction.is_active
        )
    }

    #[view]
    public fun get_all_active_auctions(marketplace_addr: address): vector<u64> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let active_auctions = vector::empty<u64>();
        let i = 0;
        
        while (i < vector::length(&marketplace.auctions)) {
            let auction = vector::borrow(&marketplace.auctions, i);
            if (auction.is_active && timestamp::now_seconds() < auction.end_time) {
                vector::push_back(&mut active_auctions, i);
            };
            i = i + 1;
        };
        
        active_auctions
    }

    #[view]
    public fun get_auctions_by_seller(marketplace_addr: address, seller_addr: address): vector<u64> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let seller_auctions = vector::empty<u64>();
        let i = 0;
        
        while (i < vector::length(&marketplace.auctions)) {
            let auction = vector::borrow(&marketplace.auctions, i);
            if (auction.seller == seller_addr) {
                vector::push_back(&mut seller_auctions, i);
            };
            i = i + 1;
        };
        
        seller_auctions
    }

    #[view]
    public fun get_auction_time_left(marketplace_addr: address, auction_id: u64): u64 acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let auction = vector::borrow(&marketplace.auctions, auction_id);
        
        if (!auction.is_active) {
            return 0
        };
        
        let current_time = timestamp::now_seconds();
        if (current_time >= auction.end_time) {
            0
        } else {
            auction.end_time - current_time
        }
    }

    #[view]
    public fun get_marketplace_stats(marketplace_addr: address): (u64, u64) acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let total_nfts = vector::length(&marketplace.nfts);
        let mut_i = 0;
        let nfts_for_sale = 0;

        while (mut_i < total_nfts) {
            let nft = vector::borrow(&marketplace.nfts, mut_i);
            if (nft.for_sale) {
                nfts_for_sale = nfts_for_sale + 1;
            };
            mut_i = mut_i + 1;
        };

        (total_nfts, nfts_for_sale)
    }
}