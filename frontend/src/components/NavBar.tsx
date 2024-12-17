import React, { useEffect, useState } from "react";
import { Layout, Typography, Menu, Space, Button, Dropdown, message } from "antd";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";
import { DownOutlined, LogoutOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";

const { Header } = Layout;
const { Text } = Typography;

const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");

interface NavBarProps {
  onMintNFTClick: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ onMintNFTClick }) => {
  const { connected, account, network, disconnect, wallet } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkWalletConnection = async () => {
      try {
        if (wallet && connected) {
          await fetchBalance();
        }
      } catch (error) {
        console.error("Wallet connection error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkWalletConnection();
  }, [wallet, connected]);

  const fetchBalance = async () => {
    if (account) {
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
    }
  };

  const handleLogout = async () => {
    try {
      await disconnect();
      setBalance(null);
      message.success("Disconnected from wallet");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      message.error("Failed to disconnect from wallet");
    }
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/my-nfts') return 'my-collection';
    return 'marketplace';
  };

  if (isLoading) {
    return null; // atau tampilkan loading spinner
  }

  return (
    <Header
      style={{ 
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: 'transparent',
        padding: "0 20px",
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <img src="/Aptos_Primary_WHT.png" alt="Aptos Logo" style={{ height: '40px', marginRight: 16 }} />
        <Menu 
          theme="dark" 
          mode="horizontal" 
          selectedKeys={[getSelectedKey()]}
          style={{ backgroundColor: 'transparent', borderBottom: 'none' }}
        >
          <Menu.Item key="marketplace">
            <Link to="/" style={{ color: "#fff" }}>Marketplace</Link>
          </Menu.Item>
          <Menu.Item key="my-collection">
            <Link to="/my-nfts" style={{ color: "#fff" }}>My Collection</Link>
          </Menu.Item>
        </Menu>
      </div>

      <Space style={{ alignItems: "center" }}>
        {connected && account ? (
          <Dropdown
            overlay={
              <Menu
                style={{
                  background: 'rgba(0, 0, 30, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Menu.Item key="address" style={{ color: '#fff' }}>
                  <Text strong style={{ color: '#0fffc4' }}>Address:</Text> <br />
                  <Text copyable style={{ color: '#fff' }}>{account.address}</Text>
                </Menu.Item>
                <Menu.Item key="network" style={{ color: '#fff' }}>
                  <Text strong style={{ color: '#0fffc4' }}>Network:</Text>{' '}
                  {network ? network.name : "Unknown"}
                </Menu.Item>
                <Menu.Item key="balance" style={{ color: '#fff' }}>
                  <Text strong style={{ color: '#0fffc4' }}>Balance:</Text>{' '}
                  {balance !== null ? `${balance} APT` : "Loading..."}
                </Menu.Item>
                <Menu.Divider style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <Menu.Item 
                  key="logout" 
                  icon={<LogoutOutlined style={{ color: '#0fffc4' }} />} 
                  onClick={handleLogout}
                  style={{ color: '#fff' }}
                >
                  Disconnect
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
          >
            <Button
              style={{
                background: "rgba(15, 255, 196, 0.1)",
                border: "1px solid #0fffc4",
                color: "#0fffc4",
                fontWeight: "bold",
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              className="connect-button"
            >
              Connected <DownOutlined />
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