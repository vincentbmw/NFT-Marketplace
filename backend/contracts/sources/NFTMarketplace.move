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
    const EDUPLICATE_NFT_NAME: u64 = 1005;
    const EDUPLICATE_NFT_URI: u64 = 1006;
    const ENFT_NOT_FOR_SALE: u64 = 400;
    const EINSUFFICIENT_PAYMENT: u64 = 401;
    const ECANNOT_BUY_OWN_NFT: u64 = 402;
    
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

    // Fungsi helper untuk mengecek apakah nama NFT sudah ada
    fun is_nft_name_exists(marketplace: &Marketplace, name: &vector<u8>): bool {
        let i = 0;
        let len = vector::length(&marketplace.nfts);
        
        while (i < len) {
            let nft = vector::borrow(&marketplace.nfts, i);
            if (nft.name == *name) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // Tambahkan fungsi helper untuk mengecek URI
    fun is_nft_uri_exists(marketplace: &Marketplace, uri: &vector<u8>): bool {
        let i = 0;
        let len = vector::length(&marketplace.nfts);
        
        while (i < len) {
            let nft = vector::borrow(&marketplace.nfts, i);
            if (nft.uri == *uri) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // TODO# 8: Mint New NFT
    public entry fun mint_nft_to_marketplace(
        account: &signer,
        marketplace_addr: address,
        name: vector<u8>, 
        description: vector<u8>, 
        uri: vector<u8>, 
        rarity: u8
    ) acquires Marketplace {
        // Validasi input
        assert!(vector::length(&name) > 0, 1000);
        assert!(vector::length(&description) > 0, 1001);
        assert!(vector::length(&uri) > 0, 1002);
        assert!(rarity >= 1 && rarity <= 4, 1003); // Validasi rarity range

        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        
        // Check if NFT name already exists
        assert!(!is_nft_name_exists(marketplace, &name), EDUPLICATE_NFT_NAME);
        // Check if NFT URI already exists
        assert!(!is_nft_uri_exists(marketplace, &uri), EDUPLICATE_NFT_URI);

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

    // Update fungsi mint_nft untuk backward compatibility
    public entry fun mint_nft(
        account: &signer,
        name: vector<u8>, 
        description: vector<u8>, 
        uri: vector<u8>, 
        rarity: u8
    ) acquires Marketplace {
        mint_nft_to_marketplace(account, signer::address_of(account), name, description, uri, rarity)
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

        // Validasi dengan error code yang spesifik
        assert!(nft_ref.for_sale, ENFT_NOT_FOR_SALE);
        assert!(payment >= nft_ref.price, EINSUFFICIENT_PAYMENT);
        
        let buyer_address = signer::address_of(account);
        assert!(nft_ref.owner != buyer_address, ECANNOT_BUY_OWN_NFT);

        // Calculate marketplace fee
        let fee = (nft_ref.price * MARKETPLACE_FEE_PERCENT) / 100;
        let seller_revenue = payment - fee;

        // Transfer payment
        coin::transfer<AptosCoin>(account, nft_ref.owner, seller_revenue);
        coin::transfer<AptosCoin>(account, marketplace_addr, fee);

        // Transfer ownership
        nft_ref.owner = buyer_address;
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
        
        // Validasi kepemilikan dan status NFT
        let sender = signer::address_of(account);
        assert!(nft.owner == sender, error::permission_denied(1)); // Harus pemilik NFT
        assert!(!nft.for_sale, error::invalid_state(2)); // NFT tidak boleh dalam status for_sale

        // Validasi durasi
        assert!(duration >= 300 && duration <= 86400, 3); // Durasi antara 5 menit dan 1 hari
        assert!(start_price > 0, 4); // Harga awal harus lebih dari 0

        let auction = Auction {
            nft_id,
            seller: sender,
            start_price,
            current_price: start_price,
            highest_bidder: @0x0,
            end_time: timestamp::now_seconds() + duration,
            is_active: true
        };

        // Set NFT status menjadi for_sale
        nft.for_sale = true;

        vector::push_back(&mut marketplace.auctions, auction);
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
        
        // Hanya seller atau marketplace admin yang bisa mengakhiri auction
        let sender = signer::address_of(account);
        assert!(
            sender == auction.seller || sender == marketplace_addr, 
            error::permission_denied(1)
        );
        
        // Ambil referensi NFT
        let nft = vector::borrow_mut(&mut marketplace.nfts, auction.nft_id);
        
        // Simpan data yang diperlukan sebelum menutup auction
        let has_bidder = auction.highest_bidder != @0x0;
        let winning_bidder = auction.highest_bidder;
        let final_price = auction.current_price;
        let seller_address = auction.seller;

        // Tutup auction terlebih dahulu
        auction.is_active = false;

        // Reset status for_sale NFT
        nft.for_sale = false;

        // Proses transfer berdasarkan ada tidaknya bidder
        if (has_bidder) {
            // Transfer NFT ke pemenang
            nft.owner = winning_bidder;

            // Hitung fee dan transfer dana
            let fee_amount = (final_price * MARKETPLACE_FEE_PERCENT) / 100;
            let seller_amount = final_price - fee_amount;

            // Transfer dana ke seller dan marketplace
            coin::transfer<AptosCoin>(account, seller_address, seller_amount);
            coin::transfer<AptosCoin>(account, marketplace_addr, fee_amount);
        } else {
            // Kembalikan NFT ke seller jika tidak ada bidder
            nft.owner = seller_address;
        };
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

    // Tambahkan fungsi cancel_listing
    public entry fun cancel_listing(
        account: &signer,
        marketplace_addr: address,
        nft_id: u64
    ) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft = vector::borrow_mut(&mut marketplace.nfts, nft_id);
        
        // Validasi kepemilikan dan status NFT
        let sender = signer::address_of(account);
        assert!(nft.owner == sender, error::permission_denied(1)); // Harus pemilik NFT
        assert!(nft.for_sale, error::invalid_state(2)); // NFT harus dalam status for_sale

        // Reset status penjualan
        nft.for_sale = false;
        nft.price = 0;
    }
}