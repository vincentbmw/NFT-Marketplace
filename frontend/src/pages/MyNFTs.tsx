import React, { useEffect, useState, useCallback } from "react";
import { Typography, Card, Row, Col, Pagination, message, Button, Input, Modal, Tabs, Statistic, Empty, Tag } from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ShoppingOutlined, GiftOutlined, WalletOutlined } from "@ant-design/icons";

const { Title } = Typography;
const { Meta } = Card;
const { TabPane } = Tabs;

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");

type NFT = {
  id: number;
  name: string;
  description: string;
  uri: string;
  rarity: number;
  price: number;
  for_sale: boolean;
  owner: string;
  is_in_auction: boolean;
};

type Auction = {
  auction_id: number;
  nft_id: number;
  seller: string;
  start_price: number;
  current_price: number;
  highest_bidder: string;
  end_time: number;
  is_active: boolean;
  nft_details?: {
    name: string;
    description: string;
    uri: string;
    rarity: number;
  };
};

type MoveValue = string | number | boolean | Array<any>;

const rarityLabels: { [key: number]: string } = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Super Rare",
};

const rarityColors: { [key: number]: string } = {
  1: "#4CAF50",
  2: "#2196F3",
  3: "#9C27B0",
  4: "#FF9800",
};

interface MyNFTsProps {
  onMintNFTClick?: () => void;
}

const truncateAddress = (address: string, start = 6, end = 4) => {
  if (address === '0x0' || address === '0x00' || address.match(/^0x0+$/)) {
    return '-';
  }
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

const decodeHexString = (hexString: string): string => {
  if (typeof hexString !== 'string' || !hexString.startsWith('0x')) {
    return '';
  }
  const bytes = new Uint8Array(hexString.length / 2 - 1);
  for (let i = 2; i < hexString.length; i += 2) {
    bytes[(i-2) / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return new TextDecoder().decode(bytes);
};

const MyNFTs: React.FC<MyNFTsProps> = ({ onMintNFTClick }) => {
  const pageSize = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [myAuctions, setMyAuctions] = useState<Auction[]>([]);
  const [totalNFTs, setTotalNFTs] = useState(0);
  const { account } = useWallet();
  const marketplaceAddr = "0x064da1f2bc7bbeb3845f33486757d7a6e3ba2778dd79d76643e2f8a92442d325";

  const [activeTab, setActiveTab] = useState("1");
  const [isListingModalVisible, setIsListingModalVisible] = useState(false);
  const [isAuctionModalVisible, setIsAuctionModalVisible] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [listingPrice, setListingPrice] = useState("");
  const [auctionStartPrice, setAuctionStartPrice] = useState("");
  const [auctionDuration, setAuctionDuration] = useState("");
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));

  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);
  const [lastAuctionFetchTimestamp, setLastAuctionFetchTimestamp] = useState(0);

  const fetchUserNFTs = useCallback(async () => {
    if (!account) return;

    try {
      if (Date.now() - lastFetchTimestamp < 2000) return;
      setLastFetchTimestamp(Date.now());

      const [isInitialized, nftIdsResponse] = await Promise.all([
        client.view({
          function: `${marketplaceAddr}::nft_marketplace::is_marketplace_initialized`,
          type_arguments: [],
          arguments: [marketplaceAddr],
        }),
        client.view({
          function: `${marketplaceAddr}::nft_marketplace::get_all_nfts_for_owner`,
          arguments: [marketplaceAddr, account.address, "100", "0"],
          type_arguments: [],
        })
      ]);

      if (!isInitialized[0]) {
        message.error("Marketplace not initialized");
        return;
      }

      const nftIds = Array.isArray(nftIdsResponse[0]) ? nftIdsResponse[0] : [];
      setTotalNFTs(nftIds.length);

      const batchSize = 5;
      const nftDetails = [];
      
      for (let i = 0; i < nftIds.length; i += batchSize) {
        const batch = nftIds.slice(i, i + batchSize);
        const batchPromises = batch.map(id => 
          client.view({
            function: `${marketplaceAddr}::nft_marketplace::get_nft_details`,
            arguments: [marketplaceAddr, id],
            type_arguments: [],
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        nftDetails.push(...batchResults);
        
        if (i + batchSize < nftIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const validNFTs = nftDetails
        .map((details, index) => {
          try {
            const [nftId, owner, name, description, uri, price, forSale, rarity] = details;
            return {
              id: Number(nftId),
              owner: String(owner),
              name: decodeHexString(name as string),
              description: decodeHexString(description as string),
              uri: decodeHexString(uri as string),
              price: Number(price) / 100000000,
              for_sale: Boolean(forSale),
              rarity: Number(rarity),
              is_in_auction: myAuctions.some(
                auction => auction.nft_id === Number(nftId) && auction.is_active
              )
            };
          } catch (err) {
            console.error("Error processing NFT:", err);
            return null;
          }
        })
        .filter((nft): nft is NFT => nft !== null);

      setNfts(validNFTs);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
    }
  }, [account, marketplaceAddr, myAuctions]);

  const fetchMyAuctions = useCallback(async () => {
    if (!account) return;

    try {
      if (Date.now() - lastAuctionFetchTimestamp < 2000) return;
      setLastAuctionFetchTimestamp(Date.now());

      const response = await client.view({
        function: `${marketplaceAddr}::nft_marketplace::get_auctions_by_seller`,
        arguments: [marketplaceAddr, account.address],
        type_arguments: [],
      });

      const auctionIds = Array.isArray(response[0]) ? response[0] : [];
      
      const batchSize = 5;
      const auctionsData = [];
      
      for (let i = 0; i < auctionIds.length; i += batchSize) {
        const batch = auctionIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (id) => {
          const [details, nftDetails] = await Promise.all([
            client.view({
              function: `${marketplaceAddr}::nft_marketplace::get_auction_details`,
              arguments: [marketplaceAddr, id],
              type_arguments: [],
            }),
            client.view({
              function: `${marketplaceAddr}::nft_marketplace::get_nft_details`,
              arguments: [marketplaceAddr, id],
              type_arguments: [],
            })
          ]);

          return { details, nftDetails };
        });

        const batchResults = await Promise.all(batchPromises);
        auctionsData.push(...batchResults);

        if (i + batchSize < auctionIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const processedAuctions = auctionsData.map(({ details, nftDetails }) => {
        const [nftId, seller, startPrice, currentPrice, highestBidder, endTime, isActive] = details;
        const [_, __, name, description, uri, ___, ____, rarity] = nftDetails;

        return {
          auction_id: Number(nftId),
          nft_id: Number(nftId),
          seller: String(seller),
          start_price: Number(startPrice) / 100000000,
          current_price: Number(currentPrice) / 100000000,
          highest_bidder: String(highestBidder),
          end_time: Number(endTime),
          is_active: Boolean(isActive),
          nft_details: {
            name: decodeHexString(name as string),
            description: decodeHexString(description as string),
            uri: decodeHexString(uri as string),
            rarity: Number(rarity),
          }
        };
      });

      setMyAuctions(processedAuctions);
    } catch (error) {
      console.error("Error fetching auctions:", error);
    }
  }, [account, marketplaceAddr]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!isMounted) return;
      await Promise.all([fetchMyAuctions(), fetchUserNFTs()]);
    };

    fetchData();
    
    const interval = setInterval(fetchData, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchMyAuctions, fetchUserNFTs]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const checkExpiredAuctions = async () => {
      if (!isMounted || !account) return;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const expiredAuctions = myAuctions.filter(
        auction => auction.is_active && 
                  auction.end_time <= currentTime &&
                  auction.end_time > 0
      );

      for (const auction of expiredAuctions) {
        try {
          const auctionDetails = await client.view({
            function: `${marketplaceAddr}::nft_marketplace::get_auction_details`,
            type_arguments: [],
            arguments: [marketplaceAddr, auction.auction_id.toString()],
          });
          
          const isStillActive = auctionDetails[6];
          
          if (isStillActive) {
            const payload = {
              type: "entry_function_payload",
              function: `${marketplaceAddr}::nft_marketplace::end_auction`,
              type_arguments: [],
              arguments: [marketplaceAddr, auction.auction_id.toString()],
            };

            const response = await (window as any).aptos.signAndSubmitTransaction(payload);
            await client.waitForTransaction(response.hash);
            console.log(`Auction ${auction.auction_id} ended automatically`);
          }
        } catch (error: any) {
          if (!error.message?.includes('EAUCTION_NOT_ACTIVE')) {
            console.error(`Error ending auction ${auction.auction_id}:`, error);
          }
        }
      }

      if (expiredAuctions.length > 0) {
        await Promise.all([
          fetchMyAuctions(),
          fetchUserNFTs()
        ]);
      }
    };

    const interval = setInterval(checkExpiredAuctions, 30000);
    
    checkExpiredAuctions();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [myAuctions, account, fetchMyAuctions, fetchUserNFTs, marketplaceAddr]);

  const handleCreateAuction = async () => {
    if (!selectedNft) return;

    try {
      const duration = parseInt(auctionDuration);
      if (isNaN(duration) || duration < 300 || duration > 86400) {
        message.error("Duration must be between 300 and 86400 seconds");
        return;
      }

      const startPrice = parseFloat(auctionStartPrice);
      if (isNaN(startPrice) || startPrice <= 0) {
        message.error("Please enter a valid starting price");
        return;
      }

      const startPriceInOctas = Math.floor(startPrice * 100000000);

      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::nft_marketplace::create_auction`,
        type_arguments: [],
        arguments: [
          marketplaceAddr,
          selectedNft.id.toString(),
          startPriceInOctas.toString(),
          duration.toString()
        ],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);

      message.success("Auction created successfully!");
      setIsAuctionModalVisible(false);
      setAuctionStartPrice("");
      setAuctionDuration("");
      await Promise.all([
        fetchMyAuctions(),
        fetchUserNFTs()
      ]);
    } catch (error) {
      console.error("Error creating auction:", error);
      message.error("Failed to create auction.");
    }
  };

  const handleListForSale = async () => {
    if (!selectedNft || !listingPrice) return;

    try {
      const priceInOctas = parseFloat(listingPrice) * 100000000;

      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::nft_marketplace::list_for_sale`,
        type_arguments: [],
        arguments: [marketplaceAddr, selectedNft.id.toString(), priceInOctas.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);

      message.success("NFT listed for sale successfully!");
      setIsListingModalVisible(false);
      fetchUserNFTs();
    } catch (error) {
      console.error("Error listing NFT:", error);
      message.error("Failed to list NFT.");
    }
  };

  const handleEndAuction = async (auction: Auction) => {
    try {
      if (account?.address !== auction.seller && account?.address !== marketplaceAddr) {
        message.error("Only auction creator or marketplace admin can end auctions");
        return;
      }

      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::nft_marketplace::end_auction`,
        type_arguments: [],
        arguments: [marketplaceAddr, auction.auction_id.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);

      message.success("Auction ended successfully!");
      fetchMyAuctions();
      fetchUserNFTs();
    } catch (error: any) {
      console.error("Error ending auction:", error);
      if (error.message?.includes("permission denied")) {
        message.error("Only auction creator or marketplace admin can end auctions");
      } else if (error.message?.includes("EAUCTION_NOT_ACTIVE")) {
        message.error("This auction is no longer active");
      } else {
        message.error("Failed to end auction. Please try again.");
      }
    }
  };

  const handleCancelListing = async (nft: NFT) => {
    try {
      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::nft_marketplace::cancel_listing`,
        type_arguments: [],
        arguments: [marketplaceAddr, nft.id.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);

      message.success("NFT listing cancelled successfully!");
      await Promise.all([
        fetchMyAuctions(),
        fetchUserNFTs()
      ]);
    } catch (error) {
      console.error("Error cancelling listing:", error);
      message.error("Failed to cancel NFT listing.");
    }
  };

  const getNFTAuctionStatus = (nft: NFT, auction: Auction) => {
    const isInAuction = auction.is_active;
    const isAuctionEnded = auction.end_time <= currentTime;
    const hasBidder = auction.highest_bidder !== '0x0';
    const isAuctionClosed = isAuctionEnded || !isInAuction;
    const isFailedAuction = isAuctionEnded && !hasBidder;

    return {
        isInAuction,
        isAuctionEnded,
        hasBidder,
        isAuctionClosed,
        isFailedAuction
    };
  };

  const renderNFTCard = (nft: NFT) => {
    const relatedAuction = myAuctions.find(auction => auction.nft_id === nft.id);
    
    const auctionStatus = relatedAuction ? 
        getNFTAuctionStatus(nft, relatedAuction) : 
        { isInAuction: false, isAuctionClosed: false, isFailedAuction: false };

    nft.is_in_auction = auctionStatus.isInAuction && !auctionStatus.isAuctionClosed;

    return (
      <Card
        hoverable
        style={{
          width: '100%',
          maxWidth: '300px',
          margin: '0',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          color: '#f0f0f0',
          padding: '12px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
        }}
        className="nft-card"
        cover={
          <div style={{ 
            height: "200px", 
            overflow: "hidden",
            position: "relative"
          }}>
            <img
              alt={nft.name}
              src={nft.uri}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.3s ease"
              }}
            />
            <div className="nft-card-overlay"></div>
          </div>
        }
      >
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          height: '100%',
          justifyContent: 'space-between'
        }}>
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "8px"
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: "16px", 
                fontWeight: 600,
                color: "#fff"
              }}>{nft.name}</h3>
              <Tag
                color={rarityColors[nft.rarity]}
                style={{
                  borderRadius: "12px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  border: "none"
                }}
              >
                {rarityLabels[nft.rarity]}
              </Tag>
            </div>

            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              color: "#fff"
            }}>
              <p style={{ margin: 0 }}>Price: {nft.price.toFixed(6)} APT</p>
              <p style={{ margin: 0 }}>{nft.description}</p>
              <p style={{ margin: 0 }}>ID: {nft.id}</p>
              <p style={{ margin: 0 }}>
                {nft.for_sale ? (
                  <span style={{ 
                    background: "rgba(82, 196, 26, 0.1)", 
                    color: "#52c41a", 
                    padding: "2px 6px", 
                    borderRadius: "4px" 
                  }}>
                    Listed for Sale
                  </span>
                ) : (
                  <span style={{ 
                    background: "rgba(255, 77, 79, 0.1)", 
                    color: "#ff4d4f", 
                    padding: "2px 6px", 
                    borderRadius: "4px" 
                  }}>
                    Not Listed
                  </span>
                )}
              </p>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginTop: '16px',
            width: '100%'
          }}>
            {nft.for_sale ? (
              nft.is_in_auction ? (
                <Button
                  type="primary"
                  disabled
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '8px',
                    fontWeight: "bold",
                    opacity: 0.6
                  }}
                >
                  In Auction
                </Button>
              ) : auctionStatus.isFailedAuction ? (
                <Button
                  type="primary"
                  danger
                  onClick={() => handleCancelListing(nft)}
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '8px',
                    fontWeight: "bold",
                    background: 'rgba(255, 77, 79, 0.2)',
                    borderColor: '#ff4d4f'
                  }}
                >
                  Cancel Listing
                </Button>
              ) : (
                <Button
                  type="primary"
                  danger
                  onClick={() => handleCancelListing(nft)}
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '8px',
                    fontWeight: "bold",
                    background: 'rgba(255, 77, 79, 0.2)',
                    borderColor: '#ff4d4f'
                  }}
                >
                  Cancel Listing
                </Button>
              )
            ) : (
              <>
                <Button
                  type="primary"
                  onClick={() => {
                    setSelectedNft(nft);
                    setIsListingModalVisible(true);
                  }}
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '8px',
                    fontWeight: "bold"
                  }}
                  icon={<ShoppingOutlined />}
                >
                  List
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    setSelectedNft(nft);
                    setIsAuctionModalVisible(true);
                  }}
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '8px',
                    fontWeight: "bold"
                  }}
                  icon={<GiftOutlined />}
                >
                  Auction
                </Button>
              </>
            )}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          {nft.is_in_auction && (
            <Tag
              color="#ff4d4f"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 1,
                fontSize: "12px",
                fontWeight: "bold",
                padding: "4px 8px",
                borderRadius: "0 0 0 8px"
              }}
            >
              In Auction
            </Tag>
          )}
        </div>
      </Card>
    );
  };

  const formatPrice = (price: number | string): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return numPrice.toString().replace(/\.?0+$/, '');
  };

  const formatTimeLeft = (endTime: number): string => {
    const timeLeft = endTime - currentTime;
    if (timeLeft <= 0) return "Auction ended";

    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const renderAuctionCard = (auction: Auction) => {
    const nft = nfts.find(n => n.id === auction.nft_id);
    const auctionStatus = getNFTAuctionStatus(nft!, auction);
    
    return (
      <Card
        hoverable
        className="nft-card"
        style={{
          width: "100%",
          maxWidth: "320px",
          margin: "0 auto",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          color: "#f0f0f0",
          padding: "16px"
        }}
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Tag 
              color={
                auctionStatus.isAuctionClosed ? "default" :
                auction.end_time > currentTime ? "success" : "error"
              } 
              style={{ borderRadius: '12px' }}
            >
              {auctionStatus.isAuctionClosed ? "Auction Closed" :
               auction.end_time > currentTime ? "Active" : "Ended"}
            </Tag>
            <span style={{ 
              fontSize: '14px',
              color: '#0fffc4'
            }}>
              ID: {auction.auction_id}
            </span>
          </div>

          <Statistic
            title={<span style={{ color: "#f0f0f0", fontSize: '14px' }}>Current Bid</span>}
            value={auction.current_price}
            formatter={(value) => formatPrice(value)}
            suffix="APT"
            valueStyle={{ 
              color: "#0fffc4",
              fontSize: '24px',
              fontWeight: 'bold'
            }}
          />

          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Starting Price:</span>
              <span>{formatPrice(auction.start_price)} APT</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>NFT ID:</span>
              <span>#{auction.nft_id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Highest Bidder:</span>
              <span style={{ 
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {auction.highest_bidder === '0x0' ? 'No bids yet' : `${auction.highest_bidder.slice(0, 6)}...${auction.highest_bidder.slice(-4)}`}
              </span>
            </div>
          </div>

          <div style={{ 
            background: 'rgba(15, 255, 196, 0.1)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '8px'
          }}>
            <Statistic
              title={<span style={{ color: "#f0f0f0", fontSize: '14px' }}>Time Remaining</span>}
              value={formatTimeLeft(auction.end_time)}
              valueStyle={{ 
                color: auction.end_time - currentTime <= 300 ? '#ff4d4f' : '#fff',
                fontSize: '18px'
              }}
            />
          </div>

          <Button
            type="primary"
            danger
            disabled={
              auctionStatus.isAuctionClosed ||
              auction.end_time > currentTime || 
              (account?.address !== auction.seller && account?.address !== marketplaceAddr)
            }
            onClick={() => handleEndAuction(auction)}
            style={{
              marginTop: '8px',
              height: '40px',
              borderRadius: '8px',
              fontWeight: "bold",
              background: !auctionStatus.isAuctionClosed && auction.end_time <= currentTime && 
                          (account?.address === auction.seller || account?.address === marketplaceAddr) ? 
                'rgba(255, 77, 79, 0.2)' : 'rgba(255, 77, 79, 0.1)',
              borderColor: !auctionStatus.isAuctionClosed && auction.end_time <= currentTime && 
                           (account?.address === auction.seller || account?.address === marketplaceAddr) ? 
                '#ff4d4f' : 'transparent'
            }}
          >
            {auctionStatus.isAuctionClosed ? 'Auction Closed' :
             auction.end_time > currentTime ? 
              'Auction In Progress' : 
              (account?.address === auction.seller || account?.address === marketplaceAddr ? 
                'Claim Auction Result' : 'Not Authorized')}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <Title level={2} style={{ 
        textAlign: "center", 
        marginBottom: "32px",
        color: "#0fffc4",
        textShadow: "0 0 10px rgba(15, 255, 196, 0.5)",
        fontWeight: "bold",
        letterSpacing: "1px"
      }}>
        My NFT Collection
      </Title>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        centered
        style={{
          color: "#fff"
        }}
      >
        <TabPane 
          tab={
            <span style={{ 
              color: activeTab === "1" ? "#0fffc4" : "#fff",
              textShadow: activeTab === "1" ? "0 0 10px rgba(15, 255, 196, 0.5)" : "none",
              fontSize: "16px",
              fontWeight: activeTab === "1" ? "bold" : "normal"
            }}>
              My NFTs
            </span>
          } 
          key="1"
        >
          {nfts.length > 0 ? (
            <div style={{ 
              padding: "32px",
              width: "100%",
              display: "flex",
              justifyContent: "center"  // Center the container
            }}>
              <Row 
                gutter={[64, 64]}
                style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, 300px)', // Fixed width columns
                  gap: '48px',
                  justifyContent: 'center', // Center the grid
                  margin: '0 auto',
                  maxWidth: '1400px',
                  width: 'fit-content' // Allow container to shrink
                }}
              >
                {nfts.map((nft) => (
                  <Col 
                    key={nft.id} 
                    style={{ 
                      width: '300px', // Fixed width
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    {renderNFTCard(nft)}
                  </Col>
                ))}
              </Row>
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: 'white' }}>You don't have any NFTs yet</span>}
            />
          )}
        </TabPane>

        <TabPane 
          tab={
            <span style={{ 
              color: activeTab === "2" ? "#0fffc4" : "#fff",
              fontSize: '16px',
              fontWeight: activeTab === "2" ? "bold" : "normal",
              padding: '0 16px'
            }}>
              My Auctions
            </span>
          } 
          key="2"
        >
          {myAuctions.length > 0 ? (
            <div style={{ 
              padding: "32px",
              width: "100%",
              display: "flex",
              justifyContent: "center"  // Center the container
            }}>
              <Row 
                gutter={[48, 48]}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, 300px)', // Fixed width columns
                  gap: '48px',
                  justifyContent: 'center', // Center the grid
                  margin: '0 auto',
                  maxWidth: '1400px',
                  width: 'fit-content' // Allow container to shrink
                }}
              >
                {myAuctions.map((auction) => (
                  <Col 
                    key={auction.auction_id} 
                    style={{ 
                      width: '300px', // Fixed width
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    {renderAuctionCard(auction)}
                  </Col>
                ))}
              </Row>
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: 'white' }}>You don't have any active auctions</span>}
            />
          )}
        </TabPane>
      </Tabs>

      {activeTab === "1" && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '48px',
          marginBottom: '24px'
        }}>
          <Button
            onClick={onMintNFTClick}
            size="large"
            style={{
              background: "linear-gradient(45deg, #0fffc4, #0ff9fc)",
              border: "none",
              color: "#000",
              fontWeight: "bold",
              height: '48px',
              padding: '0 32px',
              fontSize: '16px',
              borderRadius: '24px',
              boxShadow: '0 4px 12px rgba(15, 255, 196, 0.3)'
            }}
            className="mint-button"
          >
            Mint New NFT
          </Button>
        </div>
      )}

      <Modal
        title={
          <div style={{ 
            color: "#0fffc4",
            textAlign: "center",
            fontSize: "24px",
            fontWeight: "bold",
            textShadow: "0 0 10px rgba(15, 255, 196, 0.5)"
          }}>
            List NFT for Sale
          </div>
        }
        visible={isListingModalVisible}
        onCancel={() => setIsListingModalVisible(false)}
        centered
        style={{
          background: "rgba(0, 0, 30, 0.9)",
          backdropFilter: "blur(10px)",
        }}
        bodyStyle={{
          padding: "24px",
          background: "transparent",
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => setIsListingModalVisible(false)}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#fff"
            }}
          >
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleListForSale}
            style={{
              background: "linear-gradient(45deg, #0fffc4, #0ff9fc)",
              border: "none",
              color: "#000",
              fontWeight: "bold"
            }}
            className="purchase-button"
          >
            List for Sale
          </Button>,
        ]}
      >
        {selectedNft && (
          <div style={{ 
            color: "#fff",
            background: "rgba(15, 255, 196, 0.05)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid rgba(15, 255, 196, 0.1)"
          }}>
            <div style={{ 
              display: "flex",
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <img 
                src={selectedNft.uri} 
                alt={selectedNft.name}
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginRight: "16px"
                }}
              />
              <div>
                <h3 style={{ 
                  color: "#0fffc4",
                  margin: "0 0 8px 0",
                  fontSize: "18px"
                }}>
                  {selectedNft.name}
                </h3>
                <Tag color={rarityColors[selectedNft.rarity]}>
                  {rarityLabels[selectedNft.rarity]}
                </Tag>
              </div>
            </div>

            <div style={{
              display: "grid",
              gap: "12px",
              background: "rgba(0, 0, 0, 0.2)",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>NFT ID:</span>
                <span style={{ color: "#0fffc4" }}>{selectedNft.id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>Current Owner:</span>
                <span style={{ color: "#0fffc4" }}>{truncateAddress(selectedNft.owner)}</span>
              </div>
            </div>

            <div style={{
              background: "rgba(15, 255, 196, 0.05)",
              padding: "16px",
              borderRadius: "8px"
            }}>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ 
                  color: "#0fffc4", 
                  fontSize: "14px", 
                  fontWeight: "bold" 
                }}>
                  Set Price (APT)
                </span>
              </div>
              <Input
                type="number"
                placeholder="Enter price in APT"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                style={{ 
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(15, 255, 196, 0.2)",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "8px 12px"
                }}
                min="0"
                step="0.000001"
              />
              <div style={{
                marginTop: "12px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.6)"
              }}>
                * A 2% marketplace fee will be applied when the NFT is sold
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div style={{ 
            color: "#0fffc4",
            textAlign: "center",
            fontSize: "24px",
            fontWeight: "bold",
            textShadow: "0 0 10px rgba(15, 255, 196, 0.5)"
          }}>
            Create Auction
          </div>
        }
        visible={isAuctionModalVisible}
        onCancel={() => setIsAuctionModalVisible(false)}
        centered
        style={{
          background: "rgba(0, 0, 30, 0.9)",
          backdropFilter: "blur(10px)",
        }}
        bodyStyle={{
          padding: "24px",
          background: "transparent",
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => setIsAuctionModalVisible(false)}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#fff"
            }}
          >
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleCreateAuction}
            style={{
              background: "linear-gradient(45deg, #0fffc4, #0ff9fc)",
              border: "none",
              color: "#000",
              fontWeight: "bold"
            }}
            className="purchase-button"
          >
            Create Auction
          </Button>,
        ]}
      >
        {selectedNft && (
          <div style={{ 
            color: "#fff",
            background: "rgba(15, 255, 196, 0.05)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid rgba(15, 255, 196, 0.1)"
          }}>
            <div style={{ 
              display: "flex",
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <img 
                src={selectedNft.uri} 
                alt={selectedNft.name}
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginRight: "16px"
                }}
              />
              <div>
                <h3 style={{ 
                  color: "#0fffc4",
                  margin: "0 0 8px 0",
                  fontSize: "18px"
                }}>
                  {selectedNft.name}
                </h3>
                <Tag color={rarityColors[selectedNft.rarity]}>
                  {rarityLabels[selectedNft.rarity]}
                </Tag>
              </div>
            </div>

            <div style={{
              display: "grid",
              gap: "12px",
              background: "rgba(0, 0, 0, 0.2)",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>NFT ID:</span>
                <span style={{ color: "#0fffc4" }}>{selectedNft.id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>Current Owner:</span>
                <span style={{ color: "#0fffc4" }}>{truncateAddress(selectedNft.owner)}</span>
              </div>
            </div>

            <div style={{
              background: "rgba(15, 255, 196, 0.05)",
              padding: "16px",
              borderRadius: "8px"
            }}>
              <div style={{ marginBottom: "16px" }}>
                <span style={{ 
                  color: "#0fffc4", 
                  fontSize: "14px", 
                  fontWeight: "bold",
                  display: "block",
                  marginBottom: "8px"
                }}>
                  Starting Price (APT)
                </span>
              </div>
              <Input
                type="number"
                placeholder="Enter starting price in APT"
                value={auctionStartPrice}
                onChange={(e) => setAuctionStartPrice(e.target.value)}
                style={{ 
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(15, 255, 196, 0.2)",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "8px 12px"
                }}
                min="0"
                step="0.000001"
              />
            </div>

            <div style={{
              background: "rgba(15, 255, 196, 0.05)",
              padding: "16px",
              borderRadius: "8px",
              marginTop: "16px"
            }}>
              <div style={{ marginBottom: "16px" }}>
                <span style={{ 
                  color: "#0fffc4", 
                  fontSize: "14px", 
                  fontWeight: "bold",
                  display: "block",
                  marginBottom: "8px"
                }}>
                  Duration (seconds)
                </span>
              </div>
              <Input
                type="number"
                placeholder="Enter auction duration in seconds"
                value={auctionDuration}
                onChange={(e) => setAuctionDuration(e.target.value)}
                style={{ 
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(15, 255, 196, 0.2)",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "8px 12px"
                }}
                min="300"
                max="86400"
                step="1"
              />
            </div>

            <div style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)"
            }}>
              <p style={{ margin: "0 0 4px 0" }}>
                * Minimum duration is 300 seconds (5 minutes)
              </p>
              <p style={{ margin: "0 0 4px 0" }}>
                * Maximum duration is 86400 seconds (1 day)
              </p>
              <p style={{ margin: 0 }}>
                * A 2% marketplace fee will be applied when the auction ends
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyNFTs;