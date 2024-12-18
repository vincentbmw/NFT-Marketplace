import React, { useEffect, useState } from "react";
import { Layout, Typography, Menu, Space, Button, Dropdown, message } from "antd";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";
import { DownOutlined, LogoutOutlined, ShopOutlined, WalletOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";

const { Header } = Layout;
const { Text } = Typography;

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");

interface NavBarProps {
  onMintNFTClick: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ onMintNFTClick }) => {
  const { connected, account, network, disconnect, wallet } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkWalletConnection = async () => {
      try {
        if (!mounted) return;
        
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (mounted && wallet && connected && account?.address) {
          await fetchBalance();
        }
      } catch (error) {
        console.error("Wallet connection error:", error);
        if (mounted && disconnect) {
          try {
            await disconnect();
          } catch (disconnectError) {
            console.error("Error disconnecting wallet:", disconnectError);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkWalletConnection();

    return () => {
      mounted = false;
    };
  }, [wallet, connected, disconnect, account?.address]);

  const fetchBalance = async () => {
    if (!account?.address) return;
    
    try {
      const resources = await client.getAccountResources(account.address);
      const accountResource = resources.find(
        (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );
      
      if (accountResource) {
        const balanceValue = (accountResource.data as any).coin.value;
        setBalance(balanceValue ? parseInt(balanceValue) / 100000000 : 0);
      } else {
        setBalance(0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance(0);
    }
  };

  const handleLogout = async () => {
    try {
      if (disconnect) {
        await disconnect();
        setBalance(null);
        message.success("Disconnected from wallet");
      }
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      message.error("Failed to disconnect from wallet");
    }
  };

  const handleWalletError = (error: any) => {
    console.error("Wallet error:", error);
    if (error.message?.includes("already connected")) {
      fetchBalance();
    } else {
      message.error("Wallet connection error. Please try again.");
    }
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/my-nfts') return 'my-collection';
    return 'marketplace';
  };

  if (isLoading) {
    return null;
  }

  return (
    <Header
      style={{ 
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(0, 0, 30, 0.8)",
        backdropFilter: "blur(10px)",
        padding: "0 24px",
        height: "72px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        borderBottom: '1px solid rgba(15, 255, 196, 0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src="/Aptos_Primary_WHT.png" 
            alt="Aptos Logo" 
            style={{ 
              height: '40px', 
              marginRight: '16px',
              filter: 'drop-shadow(0 0 8px rgba(15, 255, 196, 0.3))'
            }} 
          />
        </div>

        <Menu 
          mode="horizontal" 
          selectedKeys={[getSelectedKey()]}
          style={{ 
            background: 'transparent', 
            borderBottom: 'none',
            display: 'flex',
            gap: '8px'
          }}
        >
          <Menu.Item 
            key="marketplace"
            icon={<ShopOutlined style={{ fontSize: '18px' }} />}
            style={{
              color: getSelectedKey() === 'marketplace' ? '#0fffc4' : '#fff',
              borderBottom: getSelectedKey() === 'marketplace' ? '2px solid #0fffc4' : 'none',
              margin: '0 8px',
              padding: '0 16px',
              height: '72px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '16px',
              fontWeight: getSelectedKey() === 'marketplace' ? 'bold' : 'normal',
              transition: 'all 0.1s ease'
            }}
          >
            <Link to="/">Marketplace</Link>
          </Menu.Item>
          <Menu.Item 
            key="my-collection"
            icon={<WalletOutlined style={{ fontSize: '18px' }} />}
            style={{
              color: getSelectedKey() === 'my-collection' ? '#0fffc4' : '#fff',
              borderBottom: getSelectedKey() === 'my-collection' ? '2px solid #0fffc4' : 'none',
              margin: '0 8px',
              padding: '0 16px',
              height: '72px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '16px',
              fontWeight: getSelectedKey() === 'my-collection' ? 'bold' : 'normal',
              transition: 'all 0.1s ease'
            }}
          >
            <Link to="/my-nfts">My Collection</Link>
          </Menu.Item>
        </Menu>
      </div>

      <Space style={{ alignItems: "center" }}>
        {connected && account ? (
          <Dropdown
            overlay={
              <Menu
                style={{
                  background: 'rgba(0, 0, 30, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(15, 255, 196, 0.1)',
                  borderRadius: '12px',
                  padding: '8px',
                  minWidth: '240px'
                }}
              >
                <Menu.Item key="address" style={{ padding: '12px 16px' }}>
                  <Text strong style={{ color: '#0fffc4', display: 'block', marginBottom: '4px' }}>Address</Text>
                  <Text copyable style={{ color: '#fff', fontSize: '14px' }}>{account.address}</Text>
                </Menu.Item>
                <Menu.Item key="network" style={{ padding: '12px 16px' }}>
                  <Text strong style={{ color: '#0fffc4', display: 'block', marginBottom: '4px' }}>Network</Text>
                  <Text style={{ color: '#fff', fontSize: '14px' }}>{network ? network.name : "Unknown"}</Text>
                </Menu.Item>
                <Menu.Item key="balance" style={{ padding: '12px 16px' }}>
                  <Text strong style={{ color: '#0fffc4', display: 'block', marginBottom: '4px' }}>Balance</Text>
                  <Text style={{ color: '#fff', fontSize: '14px' }}>
                    {balance !== null ? `${balance} APT` : "Loading..."}
                  </Text>
                </Menu.Item>
                <Menu.Divider style={{ borderColor: 'rgba(15, 255, 196, 0.1)', margin: '4px 0' }} />
                <Menu.Item 
                  key="logout" 
                  icon={<LogoutOutlined style={{ color: '#ff4d4f' }} />}
                  onClick={handleLogout}
                  style={{ 
                    color: '#ff4d4f',
                    padding: '12px 16px',
                    transition: 'all 0.3s ease'
                  }}
                  className="logout-button"
                >
                  Disconnect
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              style={{
                background: "rgba(15, 255, 196, 0.1)",
                border: "1px solid #0fffc4",
                color: "#0fffc4",
                height: '40px',
                padding: '0 20px',
                fontSize: '15px',
                fontWeight: "500",
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '20px',
                transition: 'all 0.3s ease'
              }}
              className="connect-button"
            >
              Connected <DownOutlined style={{ fontSize: '12px' }} />
            </Button>
          </Dropdown>
        ) : (
          <WalletSelector />
        )}
      </Space>
    </Header>
  );
};

export default NavBar;