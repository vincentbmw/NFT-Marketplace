import React, { useState, useEffect } from "react";
import { Typography, Radio, message, Card, Row, Col, Pagination, Tag, Button, Modal, Tabs, Input } from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

const { Title } = Typography;
const { Meta } = Card;
const { TabPane } = Tabs;

const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");

type NFT = {
  id: number;
  owner: string;
  name: string;
  description: string;
  uri: string;
  price: number;
  for_sale: boolean;
  rarity: number;
  in_auction?: boolean;
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

interface MarketViewProps {
  marketplaceAddr: string;
}

const rarityColors: { [key: number]: string } = {
  1: "green",
  2: "blue",
  3: "purple",
  4: "orange",
};

const rarityLabels: { [key: number]: string } = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Super Rare",
};

const truncateAddress = (address: string, start = 6, end = 4) => {
  if (address === '0x0' || address === '0x00' || address.match(/^0x0+$/)) {
    return '-';
  }
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

type MoveValue = string | number | boolean | Array<any>;

const MarketView: React.FC<MarketViewProps> = ({ marketplaceAddr }) => {
  const { signAndSubmitTransaction } = useWallet();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [rarity, setRarity] = useState<'all' | number>('all');
  const [activeTab, setActiveTab] = useState("1");

  const [isBuyModalVisible, setIsBuyModalVisible] = useState(false);
  const [isBidModalVisible, setIsBidModalVisible] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bidAmount, setBidAmount] = useState("");

  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));

  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);
  const [lastAuctionFetchTimestamp, setLastAuctionFetchTimestamp] = useState(0);
  const FETCH_COOLDOWN = 5000; // 5 detik cooldown antara fetch

  const formatTimeLeft = (endTime: number): string => {
    const timeLeft = endTime - currentTime;
    if (timeLeft <= 0) return "Auction ended";

    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (!isMounted) return;
      await Promise.all([
        handleFetchNfts(rarity === 'all' ? undefined : rarity),
        fetchAuctions()
      ]);
    };

    fetchData();

    // Set interval untuk refresh data setiap 15 detik
    const interval = setInterval(fetchData, 15000);

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [rarity]);

  const fetchAuctions = async () => {
    try {
      // Check cooldown
      if (Date.now() - lastAuctionFetchTimestamp < FETCH_COOLDOWN) return;
      setLastAuctionFetchTimestamp(Date.now());

      const activeAuctions = await client.view({
        function: `${marketplaceAddr}::nft_marketplace::get_all_active_auctions`,
        type_arguments: [],
        arguments: [marketplaceAddr],
      });

      const auctionIds = Array.isArray(activeAuctions[0]) ? activeAuctions[0] : [];
      
      // Batch process auctions
      const batchSize = 5;
      const processedAuctions = [];
      
      for (let i = 0; i < auctionIds.length; i += batchSize) {
        const batch = auctionIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (auctionId: MoveValue) => {
          const [details, nftDetails] = await Promise.all([
            client.view({
              function: `${marketplaceAddr}::nft_marketplace::get_auction_details`,
              type_arguments: [],
              arguments: [marketplaceAddr, auctionId],
            }),
            client.view({
              function: `${marketplaceAddr}::nft_marketplace::get_nft_details`,
              arguments: [marketplaceAddr, auctionId],
              type_arguments: [],
            })
          ]);

          const [nftId, seller, startPrice, currentPrice, highestBidder, endTime, isActive] = details;
          const [_, __, name, description, uri, ___, ____, rarity] = nftDetails;

          return {
            auction_id: Number(auctionId),
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
          } as Auction;
        });

        const batchResults = await Promise.all(batchPromises);
        processedAuctions.push(...batchResults);

        // Add delay between batches to prevent rate limiting
        if (i + batchSize < auctionIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setAuctions(processedAuctions);
    } catch (error) {
      console.error("Error fetching auctions:", error);
    }
  };

  const handleFetchNfts = async (selectedRarity: number | undefined) => {
    try {
      // Check cooldown
      if (Date.now() - lastFetchTimestamp < FETCH_COOLDOWN) return;
      setLastFetchTimestamp(Date.now());

      const [isInitialized, response] = await Promise.all([
        client.view({
          function: `${marketplaceAddr}::nft_marketplace::is_marketplace_initialized`,
          type_arguments: [],
          arguments: [marketplaceAddr],
        }),
        client.getAccountResource(
          marketplaceAddr,
          `${marketplaceAddr}::nft_marketplace::Marketplace`
        )
      ]);

      if (!isInitialized[0]) {
        message.error("Marketplace not initialized. Please initialize first.");
        return;
      }

      if (!response || !response.data) {
        message.error("Failed to fetch marketplace data");
        return;
      }

      const nftList = (response.data as { nfts: Array<any> }).nfts;
      
      // Process NFTs in batches
      const batchSize = 5;
      const processedNfts = [];
      
      for (let i = 0; i < nftList.length; i += batchSize) {
        const batch = nftList.slice(i, i + batchSize);
        const batchNfts = batch.map(nft => {
          try {
            return {
              id: Number(nft.id),
              owner: String(nft.owner),
              name: decodeHexString(nft.name),
              description: decodeHexString(nft.description),
              uri: decodeHexString(nft.uri),
              price: Number(nft.price) / 100000000,
              for_sale: Boolean(nft.for_sale),
              rarity: Number(nft.rarity),
              in_auction: false
            } as NFT;
          } catch (err) {
            console.error("Error processing NFT:", err);
            return null;
          }
        }).filter((nft): nft is NFT => nft !== null);

        processedNfts.push(...batchNfts);

        // Add delay between batches
        if (i + batchSize < nftList.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Get auction status in one call
      const activeAuctions = await client.view({
        function: `${marketplaceAddr}::nft_marketplace::get_all_active_auctions`,
        type_arguments: [],
        arguments: [marketplaceAddr],
      });

      const auctionIds = Array.isArray(activeAuctions[0]) ? activeAuctions[0] : [];
      const auctionNftIds = new Set();

      // Process auction details in batches
      for (let i = 0; i < auctionIds.length; i += batchSize) {
        const batch = auctionIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (auctionId) => {
          const details = await client.view({
            function: `${marketplaceAddr}::nft_marketplace::get_auction_details`,
            type_arguments: [],
            arguments: [marketplaceAddr, auctionId],
          });
          return details[0]; // nftId is first element
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(nftId => auctionNftIds.add(Number(nftId)));

        if (i + batchSize < auctionIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Update auction status for all NFTs
      processedNfts.forEach(nft => {
        nft.in_auction = auctionNftIds.has(nft.id);
      });

      // Filter NFTs based on criteria
      const filteredNfts = processedNfts.filter((nft) => {
        const forSaleCondition = nft.for_sale;
        const rarityCondition = selectedRarity === undefined || nft.rarity === selectedRarity;
        return forSaleCondition && rarityCondition;
      });

      setNfts(filteredNfts);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      message.error("Failed to fetch NFTs");
    }
  };

  const handleBuyClick = (nft: NFT) => {
    const connectedAddress = (window as any).aptos?.account?.address;
    if (connectedAddress && nft.owner.toLowerCase() === connectedAddress.toLowerCase()) {
      message.error("You cannot buy your own NFT");
      return;
    }
    
    setSelectedNft(nft);
    setIsBuyModalVisible(true);
  };

  const handleCancelBuy = () => {
    setIsBuyModalVisible(false);
    setSelectedNft(null);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedNft) return;

    try {
      const connectedAddress = (window as any).aptos?.account?.address;
      if (connectedAddress && selectedNft.owner.toLowerCase() === connectedAddress.toLowerCase()) {
        Modal.error({
          title: "Cannot Buy Own NFT",
          content: "You cannot purchase your own NFT.",
          okButtonProps: {
            style: {
              background: "rgba(15, 255, 196, 0.1)",
              border: "1px solid #0fffc4",
              color: "#0fffc4",
              fontWeight: "bold",
              height: "36px",
              borderRadius: "8px"
            }
          },
          style: {
            top: '30%'
          },
          className: "custom-error-modal",
          maskStyle: {
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)'
          }
        });
        setIsBuyModalVisible(false);
        return;
      }

      const priceInOctas = selectedNft.price * 100000000;

      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::nft_marketplace::purchase_nft`,
        type_arguments: [],
        arguments: [marketplaceAddr, selectedNft.id.toString(), priceInOctas.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(entryFunctionPayload);
      await client.waitForTransaction(response.hash);

      message.success("NFT purchased successfully!");
      setIsBuyModalVisible(false);
      handleFetchNfts(rarity === 'all' ? undefined : rarity);
    } catch (error: any) {
      console.error("Error purchasing NFT:", error);
      
      let errorTitle = "Transaction Failed";
      let errorMessage = "Failed to purchase NFT.";

      if (error.message?.includes('ECANNOT_BUY_OWN_NFT') || 
          error.message?.includes('code: 402') || 
          error.message?.includes('Cannot buy own NFT')) {
        errorTitle = "Cannot Buy Own NFT";
        errorMessage = "You cannot purchase your own NFT.";
      } else if (error.message?.includes('ENFT_NOT_FOR_SALE') || 
                 error.message?.includes('code: 400')) {
        errorTitle = "NFT Not For Sale";
        errorMessage = "This NFT is not available for purchase.";
      } else if (error.message?.includes('EINSUFFICIENT_PAYMENT') || 
                 error.message?.includes('code: 401')) {
        errorTitle = "Insufficient Payment";
        errorMessage = "The payment amount is insufficient to purchase this NFT.";
      } else if (error.message?.includes('INSUFFICIENT_BALANCE')) {
        errorTitle = "Insufficient Balance";
        errorMessage = "You don't have enough balance to purchase this NFT.";
      }

      Modal.error({
        title: errorTitle,
        content: errorMessage,
        okButtonProps: {
          style: {
            background: "rgba(15, 255, 196, 0.1)",
            border: "1px solid #0fffc4",
            color: "#0fffc4",
            fontWeight: "bold",
            height: "36px",
            borderRadius: "8px"
          }
        },
        style: {
          top: '30%'
        },
        className: "custom-error-modal",
        maskStyle: {
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(4px)'
        }
      });
    }
  };

  const handleBidSubmit = async () => {
    if (!selectedAuction || !bidAmount) {
        message.error("Please enter bid amount");
        return;
    }

    try {
        const bidInOctas = Math.floor(parseFloat(bidAmount) * 100000000);
        
        // Validasi bid amount
        if (isNaN(bidInOctas) || bidInOctas <= 0) {
            message.error("Please enter a valid bid amount");
            return;
        }

        // Validasi minimum bid
        if (parseFloat(bidAmount) <= selectedAuction.current_price) {
            message.error(`Bid must be higher than current price (${selectedAuction.current_price} APT)`);
            return;
        }

        // Validasi auction masih aktif
        if (!selectedAuction.is_active || selectedAuction.end_time <= Math.floor(Date.now() / 1000)) {
            message.error("This auction has ended");
            return;
        }

        // Validasi tidak bisa bid pada auction sendiri
        if (selectedAuction.seller === (window as any).aptos?.account?.address) {
            message.error("You cannot bid on your own auction");
            return;
        }

        const payload = {
            type: "entry_function_payload",
            function: `${marketplaceAddr}::nft_marketplace::place_bid`,
            type_arguments: [],
            arguments: [
                marketplaceAddr,
                selectedAuction.auction_id.toString(),
                bidInOctas.toString()
            ],
        };

        console.log("Submitting bid with payload:", payload);
        const response = await (window as any).aptos.signAndSubmitTransaction(payload);
        console.log("Transaction response:", response);
        
        await client.waitForTransaction(response.hash);
        console.log("Transaction completed");

        message.success("Bid placed successfully!");
        setIsBidModalVisible(false);
        setBidAmount("");
        fetchAuctions();
    } catch (error: any) {
        console.error("Transaction error:", error);
        if (error.message?.includes("EINSUFFICIENT_FUNDS")) {
            message.error("Insufficient balance to place bid");
        } else if (error.message?.includes("EAUCTION_ENDED")) {
            message.error("This auction has already ended");
        } else if (error.message?.includes("EBID_TOO_LOW")) {
            message.error("Bid must be higher than the current price");
        } else if (error.message?.includes("ESELLER_CANNOT_BID")) {
            message.error("You cannot bid on your own auction");
        } else {
            message.error(`Failed to place bid: ${error.message}`);
        }
    }
  };

  // Update style untuk form fields
  const formItemStyle = {
    marginBottom: '24px',
    background: 'rgba(15, 255, 196, 0.05)',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(15, 255, 196, 0.1)'
  };

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(15, 255, 196, 0.2)',
    color: '#fff',
    borderRadius: '6px',
    padding: '8px 12px',
    width: '100%'
  };

  const labelStyle = {
    color: '#0fffc4',
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '8px',
    display: 'block'
  };

  const selectStyle = {
    ...inputStyle,
    '& .ant-select-selector': {
      background: 'transparent !important',
      border: 'none !important',
      color: '#fff !important'
    }
  };

  // Helper function untuk decode hex string
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

  // Tambahkan fungsi helper untuk mengecek status auction
  const getAuctionStatus = (auction: Auction) => {
    const isActive = auction.is_active;
    const isEnded = auction.end_time <= currentTime;
    const hasBidder = auction.highest_bidder !== '0x0';
    const isFailedAuction = isEnded && !hasBidder;

    return {
        isActive,
        isEnded,
        hasBidder,
        isFailedAuction
    };
  };

  // Update bagian render auction card
  const renderAuctionCard = (auction: Auction) => {
    const status = getAuctionStatus(auction);
    
    if (status.isFailedAuction) {
        return null; // Tidak menampilkan auction yang gagal di marketplace
    }

    // ... kode render card yang sudah ada ...
  };

  return (
    <div style={{ 
      padding: "24px", 
      maxWidth: "1200px", 
      margin: "0 auto",
      minHeight: "calc(100vh - 64px)",
      overflowY: "auto"
    }}>
      <Title level={2} style={{ 
        textAlign: "center", 
        marginBottom: "32px",
        color: "#0fffc4",
        textShadow: "0 0 10px rgba(15, 255, 196, 0.5)",
        fontWeight: "bold",
        letterSpacing: "1px"
      }}>
        NFT Marketplace
      </Title>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        centered
        style={{
          color: "#fff"
        }}
        tabBarStyle={{
          border: 'none',
          marginBottom: '24px'
        }}
      >
        <TabPane 
          tab={
            <span style={{ 
              color: activeTab === "1" ? "#0fffc4" : "#fff",
              fontSize: '16px',
              fontWeight: activeTab === "1" ? "bold" : "normal",
              padding: '0 16px'
            }}>
              Buy Now
            </span>
          } 
          key="1"
        >
          <div style={{ 
            textAlign: "center", 
            marginBottom: "32px",
            background: "rgba(15, 255, 196, 0.05)",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid rgba(15, 255, 196, 0.1)",
            backdropFilter: "blur(10px)"
          }}>
            <Radio.Group
              value={rarity}
              onChange={(e) => {
                const selectedRarity = e.target.value;
                setRarity(selectedRarity);
                handleFetchNfts(selectedRarity === 'all' ? undefined : selectedRarity);
              }}
              buttonStyle="solid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '8px',
                maxWidth: '800px',
                margin: '0 auto',
                padding: '0 8px'
              }}
            >
              <Radio.Button 
                value="all"
                style={{
                  background: rarity === 'all' ? 'rgba(15, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(15, 255, 196, 0.3)',
                  color: rarity === 'all' ? '#0fffc4' : '#fff',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  width: '100%',
                  minWidth: '80px'
                }}
              >
                All
              </Radio.Button>
              {Object.entries(rarityLabels).map(([key, label]) => (
                <Radio.Button 
                  key={key} 
                  value={parseInt(key)}
                  style={{
                    background: rarity === parseInt(key) ? 'rgba(15, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(15, 255, 196, 0.3)',
                    color: rarity === parseInt(key) ? '#0fffc4' : '#fff',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    width: '100%',
                    minWidth: '80px'
                  }}
                >
                  {label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          <div style={{ 
            padding: "32px",
            width: "100%",
            display: "flex",
            justifyContent: "center"
          }}>
            <Row 
              gutter={[48, 48]}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 300px))',
                gap: '32px',
                justifyContent: 'center',
                margin: '0 auto',
                maxWidth: '1400px',
                width: '100%'
              }}
            >
              {nfts.map((nft) => (
                <Col 
                  key={nft.id}
                  style={{ 
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <Card
                    hoverable
                    style={{
                      width: "100%",
                      maxWidth: "300px",
                      margin: "0",
                      padding: "16px",
                      backgroundColor: "#1f1f1f",
                      border: "1px solid #333",
                      height: '100%'
                    }}
                    cover={
                      <div className="nft-card-cover" style={{ position: "relative" }}>
                        <img 
                          alt={nft.name} 
                          src={nft.uri} 
                          style={{ width: "100%", height: "200px", objectFit: "cover" }} 
                        />
                        <div className="nft-card-overlay"></div>
                      </div>
                    }
                    actions={[
                      nft.in_auction ? null : (
                        <Button 
                          type="primary" 
                          style={{
                            backgroundColor: "#0fffc4",
                            borderColor: "#0fffc4",
                            color: "#000",
                            fontWeight: "bold"
                          }}
                          onClick={() => handleBuyClick(nft)}
                          disabled={(window as any).aptos?.account?.address && 
                            nft.owner.toLowerCase() === (window as any).aptos?.account?.address.toLowerCase()}
                        >
                          {(window as any).aptos?.account?.address && 
                           nft.owner.toLowerCase() === (window as any).aptos?.account?.address.toLowerCase() 
                            ? "Your NFT" 
                            : "Buy Now"}
                        </Button>
                      )
                    ]}
                  >
                    <div style={{ position: 'relative' }}>
                      {nft.in_auction && (
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
                      
                      <Tag
                        color={rarityColors[nft.rarity]}
                        style={{
                          fontSize: "14px",
                          fontWeight: "bold",
                          marginBottom: "10px",
                          display: "inline-block"
                        }}
                      >
                        {rarityLabels[nft.rarity]}
                      </Tag>
                    </div>

                    <Meta
                      title={
                        <span style={{ color: "#fff", fontSize: "16px", fontWeight: "600", lineHeight: "1.4" }}>
                          {nft.name}
                        </span>
                      }
                      description={
                        <div style={{ whiteSpace: "normal", wordWrap: "break-word", color: "#fff", fontSize: "14px", lineHeight: "1.4", marginTop: "8px" }}>
                          <p style={{ marginBottom: "8px" }}>Price: {nft.price} APT</p>
                          <p style={{ marginBottom: "8px" }}>{nft.description}</p>
                          <p style={{ marginBottom: "8px" }}>ID: {nft.id}</p>
                          <p style={{ marginBottom: 0 }}>Owner: {truncateAddress(nft.owner)}</p>
                          {nft.in_auction && (
                            <p style={{ 
                              marginTop: "8px",
                              color: "#ff4d4f",
                              fontSize: "12px",
                              fontStyle: "italic"
                            }}>
                              * This NFT is currently in an auction. Please check the Auctions tab to bid.
                            </p>
                          )}
                        </div>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </TabPane>

        <TabPane 
          tab={
            <span style={{ 
              color: activeTab === "2" ? "#0fffc4" : "#fff",
              fontSize: '16px',
              fontWeight: activeTab === "2" ? "bold" : "normal",
              padding: '0 16px'
            }}>
              Auctions
            </span>
          } 
          key="2"
        >
          <div style={{ 
            padding: "32px",
            width: "100%",
            display: "flex",
            justifyContent: "center"
          }}>
            <Row 
              gutter={[48, 48]}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 300px))',
                gap: '32px',
                justifyContent: 'center',
                margin: '0 auto',
                maxWidth: '1400px',
                width: '100%'
              }}
            >
              {auctions.map((auction) => (
                <Col 
                  key={auction.nft_id}
                  style={{ 
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <Card
                    hoverable
                    style={{
                      width: "100%",
                      maxWidth: "300px",
                      margin: "0",
                      padding: "16px",
                      backgroundColor: "#1f1f1f",
                      border: "1px solid #333",
                      height: '100%'
                    }}
                    cover={
                      auction.nft_details && (
                        <div className="nft-card-cover" style={{ position: "relative" }}>
                          <img 
                            alt={auction.nft_details.name} 
                            src={auction.nft_details.uri} 
                            style={{ width: "100%", height: "200px", objectFit: "cover" }} 
                          />
                          <div className="nft-card-overlay"></div>
                        </div>
                      )
                    }
                    actions={[
                      <Button 
                        type="primary"
                        style={{
                          backgroundColor: "#0fffc4",
                          borderColor: "#0fffc4",
                          color: "#000",
                          fontWeight: "bold"
                        }}
                        onClick={() => {
                          setSelectedAuction(auction);
                          setIsBidModalVisible(true);
                        }}
                      >
                        Place Bid
                      </Button>
                    ]}
                  >
                    {auction.nft_details && (
                      <Tag
                        color={rarityColors[auction.nft_details.rarity]}
                        style={{
                          fontSize: "14px",
                          fontWeight: "bold",
                          marginBottom: "10px",
                          display: "inline-block"
                        }}
                      >
                        {rarityLabels[auction.nft_details.rarity]}
                      </Tag>
                    )}

                    <Meta
                      title={
                        <span style={{ color: "#fff", fontSize: "16px", fontWeight: "600", lineHeight: "1.4" }}>
                          {auction.nft_details?.name}
                        </span>
                      }
                      description={
                        <div style={{ whiteSpace: "normal", wordWrap: "break-word", color: "#fff", fontSize: "14px", lineHeight: "1.4", marginTop: "8px" }}>
                          <div style={{ 
                            background: 'rgba(15, 255, 196, 0.1)',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '12px'
                          }}>
                            <p style={{ marginBottom: "8px" }}>Current Bid: {auction.current_price} APT</p>
                            <p style={{ marginBottom: "8px" }}>Starting Price: {auction.start_price} APT</p>
                            <p style={{ 
                              marginBottom: "8px",
                              color: auction.end_time - currentTime <= 300 ? '#ff4d4f' : '#0fffc4'
                            }}>
                              Time Left: {formatTimeLeft(auction.end_time)}
                            </p>
                            <p style={{ marginBottom: 0 }}>Highest Bidder: {truncateAddress(auction.highest_bidder)}</p>
                          </div>
                          <p style={{ marginBottom: "8px" }}>{auction.nft_details?.description}</p>
                          <p style={{ marginBottom: "8px" }}>NFT ID: {auction.nft_id}</p>
                          <p style={{ marginBottom: 0 }}>Seller: {truncateAddress(auction.seller)}</p>
                        </div>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </TabPane>
      </Tabs>

      <Modal
        title={
          <div style={{ 
            color: "#0fffc4",
            textAlign: "center",
            fontSize: "24px",
            fontWeight: "bold",
            textShadow: "0 0 10px rgba(15, 255, 196, 0.5)",
            letterSpacing: "1px"
          }}>
            Mint NFT
          </div>
        }
        visible={isBuyModalVisible}
        onCancel={handleCancelBuy}
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
            onClick={handleCancelBuy}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#fff"
            }}
          >
            Cancel
          </Button>,
          <Button 
            key="confirm" 
            type="primary" 
            onClick={handleConfirmPurchase}
            style={{
              background: "linear-gradient(45deg, #0fffc4, #0ff9fc)",
              border: "none",
              color: "#000",
              fontWeight: "bold"
            }}
            className="purchase-button"
          >
            Confirm Purchase
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
              borderRadius: "8px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>NFT ID:</span>
                <span style={{ color: "#0fffc4" }}>{selectedNft.id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>Price:</span>
                <span style={{ color: "#0fffc4", fontWeight: "bold" }}>
                  {selectedNft.price} APT
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>Seller:</span>
                <span style={{ color: "#0fffc4" }}>{truncateAddress(selectedNft.owner)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>Marketplace Fee:</span>
                <span style={{ color: "#0fffc4" }}>2%</span>
              </div>
            </div>

            <div style={{
              marginTop: "20px",
              padding: "12px",
              background: "rgba(15, 255, 196, 0.1)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "rgba(255,255,255,0.8)"
            }}>
              <p style={{ margin: 0 }}>
                By confirming this purchase, you agree to pay {selectedNft.price} APT for this NFT.
                A 2% marketplace fee will be applied to this transaction.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Place Bid"
        visible={isBidModalVisible}
        onCancel={() => {
          setIsBidModalVisible(false);
          setBidAmount(""); // Reset bid amount when closing
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsBidModalVisible(false);
            setBidAmount("");
          }}>
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleBidSubmit}
            style={{
              backgroundColor: "#0fffc4",
              borderColor: "#0fffc4",
              color: "#000"
            }}
          >
            Place Bid
          </Button>,
        ]}
      >
        {selectedAuction && (
          <div style={{ color: "#fff" }}>
            <p>Current Price: {selectedAuction.current_price} APT</p>
            <p style={{ 
              color: '#0fffc4', 
              fontSize: '12px', 
              marginBottom: '16px'
            }}>
              * Minimum bid must be higher than current price
            </p>
            <Input
              type="number"
              placeholder="Enter bid amount in APT"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              style={{ marginTop: 16 }}
              min={selectedAuction.current_price + 0.000001}
              step="0.000001"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MarketView;