import React, { useState, useEffect } from "react";
import { Layout, Modal, Form, Input, Select, Button, message, Typography } from "antd";
import NavBar from "./components/NavBar";
import MarketView from "./pages/MarketView";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import MyNFTs from "./pages/MyNFTs";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");
const marketplaceAddr = "0x64da1f2bc7bbeb3845f33486757d7a6e3ba2778dd79d76643e2f8a92442d325";

function AppContent() {
  const { signAndSubmitTransaction } = useWallet();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    checkInitialization();
    if (location.pathname) {
      navigate(location.pathname);
    }
  }, []);

  const checkInitialization = async () => {
    try {
      console.log("Checking initialization for address:", marketplaceAddr);
      const response = await client.view({
        function: `${marketplaceAddr}::nft_marketplace::is_marketplace_initialized`,
        type_arguments: [],
        arguments: [marketplaceAddr],
      });
      console.log("Initialization response:", response);
      setIsInitialized(Boolean(response[0]));
    } catch (error) {
      console.error("Error checking initialization:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
      setIsInitialized(false);
    }
  };

  const handleInitializeMarketplace = async () => {
    try {
      console.log("Initializing marketplace at address:", marketplaceAddr);
      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::nft_marketplace::initialize`,
        type_arguments: [],
        arguments: [],
      };
      console.log("Initialization payload:", payload);

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      console.log("Transaction submitted:", response);
      await client.waitForTransaction(response.hash);
      console.log("Transaction completed");
      
      message.success("Marketplace initialized successfully!");
      setIsInitialized(true);
    } catch (error) {
      console.error("Error initializing marketplace:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        message.error(`Failed to initialize marketplace: ${error.message}`);
      } else {
        message.error("Failed to initialize marketplace");
      }
    }
  };

  // Function to open the Mint NFT modal
  const handleMintNFTClick = () => setIsModalVisible(true);

  const handleMintNFT = async (values: { name: string; description: string; uri: string; rarity: number }) => {
    try {
      const nameVector = Array.from(new TextEncoder().encode(values.name));
      const descriptionVector = Array.from(new TextEncoder().encode(values.description));
      const uriVector = Array.from(new TextEncoder().encode(values.uri));

      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::nft_marketplace::mint_nft_to_marketplace`,
        type_arguments: [],
        arguments: [
          marketplaceAddr,
          nameVector,
          descriptionVector,
          uriVector,
          values.rarity
        ],
      };

      const txnResponse = await (window as any).aptos.signAndSubmitTransaction(entryFunctionPayload);
      await client.waitForTransaction(txnResponse.hash);

      message.success("NFT minted successfully!");
      setIsModalVisible(false);
      
      // Reset form
      form.resetFields();
      
      // Emit an event that NFT was minted
      window.dispatchEvent(new CustomEvent('nftMinted'));
    } catch (error: any) {
      console.error("Error minting NFT:", error);
      
      let errorTitle = "Minting Failed";
      let errorMessage = "Failed to mint NFT. Please try again.";
      
      if (error.message?.includes('EDUPLICATE_NFT_NAME')) {
        errorTitle = "Duplicate NFT Name";
        errorMessage = "This NFT name is already taken. Please choose a different name for your NFT.";
      } else if (error.message?.includes('EDUPLICATE_NFT_URI')) {
        errorTitle = "Duplicate Image";
        errorMessage = "This image is already being used by another NFT. Please use a different image.";
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

  return (
    <Layout>
      <NavBar onMintNFTClick={handleMintNFTClick} />
      {!isInitialized && (
        <div style={{ 
          padding: "20px", 
          textAlign: "center", 
          background: "#fff1f0", 
          marginBottom: "20px" 
        }}>
          <Typography.Text type="danger" strong>
            Marketplace not initialized. 
          </Typography.Text>
          <Button 
            type="primary" 
            danger 
            onClick={handleInitializeMarketplace}
            style={{ marginLeft: "10px" }}
          >
            Initialize Marketplace
          </Button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<MarketView marketplaceAddr={marketplaceAddr} />} />
        <Route path="/my-nfts" element={<MyNFTs onMintNFTClick={handleMintNFTClick} />} />
      </Routes>

      <Modal
        title="Mint New NFT"
        visible={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form 
          form={form}
          layout="vertical" 
          onFinish={handleMintNFT}
        >
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Please enter a name!" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description" rules={[{ required: true, message: "Please enter a description!" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="URI" name="uri" rules={[{ required: true, message: "Please enter a URI!" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Rarity" name="rarity" rules={[{ required: true, message: "Please select a rarity!" }]}>
            <Select>
              <Select.Option value={1}>Common</Select.Option>
              <Select.Option value={2}>Uncommon</Select.Option>
              <Select.Option value={3}>Rare</Select.Option>
              <Select.Option value={4}>Epic</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Mint NFT
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default AppContent; 