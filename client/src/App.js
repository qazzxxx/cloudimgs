import React, { useState, useEffect } from "react";
import {
  Layout,
  Menu,
  theme,
  message,
  ConfigProvider,
  Grid,
  Button,
  Drawer,
} from "antd";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  UploadOutlined,
  PictureOutlined,
  DashboardOutlined,
  CodeOutlined,
  FileZipOutlined,
  ToolOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import UploadComponent from "./components/UploadComponent";
import ImageGallery from "./components/ImageGallery";
import StatsComponent from "./components/StatsComponent";
import SvgToPngTool from "./components/SvgToPngTool";
import ImageCompressor from "./components/ImageCompressor";
import LogoWithText from "./components/LogoWithText";
import ThemeSwitcher from "./components/ThemeSwitcher";
import axios from "axios";

const { Header, Content, Sider } = Layout;

// 主应用组件
function AppContent({ currentTheme, onThemeChange }) {
  const [selectedKey, setSelectedKey] = useState("upload");
  const [openKeys, setOpenKeys] = useState([]);
  const [stats, setStats] = useState({});
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();

  const {
    token: { colorBgContainer, borderRadiusLG, colorBorder },
  } = theme.useToken();

  // 判断是否为移动端
  const isMobile = !screens.md;

  // 根据当前路由设置选中的菜单项
  useEffect(() => {
    const path = location.pathname;
    if (path === "/" || path === "/upload") {
      setSelectedKey("upload");
      setOpenKeys([]);
    } else if (path === "/gallery") {
      setSelectedKey("gallery");
      setOpenKeys([]);
    } else if (path === "/stats") {
      setSelectedKey("stats");
      setOpenKeys([]);
    } else if (path === "/svg-tool") {
      setSelectedKey("svg-tool");
      setOpenKeys(["tools"]);
    } else if (path === "/compressor") {
      setSelectedKey("compressor");
      setOpenKeys(["tools"]);
    }
  }, [location.pathname]);

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const response = await axios.get("/api/stats");
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("获取统计信息失败:", error);
    }
  };

  // 获取图片列表
  const fetchImages = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/images");
      if (response.data.success) {
        setImages(response.data.data);
      }
    } catch (error) {
      console.error("获取图片列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 删除图片
  const handleDeleteImage = async (filename) => {
    try {
      await axios.delete(`/api/images/${filename}`);
      message.success("图片删除成功");
      fetchImages();
      fetchStats();
    } catch (error) {
      console.error("删除图片失败:", error);
    }
  };

  // 上传成功后刷新数据
  const handleUploadSuccess = () => {
    fetchImages();
    fetchStats();
  };

  // 菜单点击处理
  const handleMenuClick = ({ key }) => {
    setSelectedKey(key);
    switch (key) {
      case "upload":
        navigate("/upload");
        break;
      case "gallery":
        navigate("/gallery");
        break;
      case "stats":
        navigate("/stats");
        break;
      case "svg-tool":
        navigate("/svg-tool");
        break;
      case "compressor":
        navigate("/compressor");
        break;
      default:
        navigate("/upload");
    }
  };

  // 菜单展开/收起处理
  const handleOpenChange = (keys) => {
    setOpenKeys(keys);
  };

  // 移动端菜单点击后自动关闭抽屉
  const handleMobileMenuClick = ({ key }) => {
    handleMenuClick({ key });
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    fetchStats();
    fetchImages();
  }, []);

  const menuItems = [
    {
      key: "upload",
      icon: <UploadOutlined />,
      label: "上传图片",
    },
    {
      key: "gallery",
      icon: <PictureOutlined />,
      label: "图片管理",
    },
    {
      key: "stats",
      icon: <DashboardOutlined />,
      label: "统计信息",
    },
    {
      key: "tools",
      icon: <ToolOutlined />,
      label: "辅助工具",
      children: [
        {
          key: "svg-tool",
          icon: <CodeOutlined />,
          label: "SVG工具",
        },
        {
          key: "compressor",
          icon: <FileZipOutlined />,
          label: "图片压缩",
        },
      ],
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: colorBgContainer,
          borderBottom: `1px solid ${colorBorder}`,
          padding: isMobile ? "0 16px" : "0 24px",
          height: isMobile ? "56px" : "64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              style={{
                marginRight: 12,
                fontSize: "16px",
                color: "inherit",
              }}
            />
          )}
          <LogoWithText
            size={isMobile ? 24 : 32}
            titleLevel={isMobile ? 4 : 3}
            style={{ verticalAlign: "middle" }}
          />
        </div>
        <ThemeSwitcher theme={currentTheme} onThemeChange={onThemeChange} />
      </Header>
      <Layout>
        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <Sider width={200} style={{ background: colorBgContainer }}>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              openKeys={openKeys}
              style={{
                height: "100%",
                borderRight: 0,
                background: colorBgContainer,
              }}
              items={menuItems}
              onClick={handleMenuClick}
              onOpenChange={handleOpenChange}
              theme={currentTheme}
            />
          </Sider>
        )}

        {/* 移动端抽屉菜单 */}
        {isMobile && (
          <Drawer
            title="菜单"
            placement="left"
            onClose={() => setMobileMenuOpen(false)}
            open={mobileMenuOpen}
            width={280}
            bodyStyle={{ padding: 0 }}
            headerStyle={{
              background: colorBgContainer,
              borderBottom: `1px solid ${colorBorder}`,
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              openKeys={openKeys}
              style={{
                height: "100%",
                borderRight: 0,
                background: colorBgContainer,
              }}
              items={menuItems}
              onClick={handleMobileMenuClick}
              onOpenChange={handleOpenChange}
              theme={currentTheme}
            />
          </Drawer>
        )}

        <Layout style={{ padding: isMobile ? "16px" : "24px" }}>
          <Content
            style={{
              padding: isMobile ? 16 : 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route
                path="/"
                element={
                  <UploadComponent onUploadSuccess={handleUploadSuccess} />
                }
              />
              <Route
                path="/upload"
                element={
                  <UploadComponent onUploadSuccess={handleUploadSuccess} />
                }
              />
              <Route
                path="/gallery"
                element={
                  <ImageGallery
                    images={images}
                    loading={loading}
                    onDelete={handleDeleteImage}
                    onRefresh={fetchImages}
                  />
                }
              />
              <Route path="/stats" element={<StatsComponent stats={stats} />} />
              <Route
                path="/svg-tool"
                element={<SvgToPngTool onUploadSuccess={handleUploadSuccess} />}
              />
              <Route
                path="/compressor"
                element={
                  <ImageCompressor onUploadSuccess={handleUploadSuccess} />
                }
              />
              <Route
                path="*"
                element={
                  <UploadComponent onUploadSuccess={handleUploadSuccess} />
                }
              />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

// 主App组件
function App() {
  const [currentTheme, setCurrentTheme] = useState("light");

  // 从localStorage加载主题设置
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // 主题切换处理
  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
  };

  return (
    <ConfigProvider
      theme={{
        algorithm:
          currentTheme === "dark"
            ? theme.darkAlgorithm
            : theme.defaultAlgorithm,
        token: {
          // 自定义菜单选中效果
          colorPrimary: currentTheme === "dark" ? "#177ddc" : "#1677ff",
          colorPrimaryHover: currentTheme === "dark" ? "#1890ff" : "#4096ff",
          colorPrimaryActive: currentTheme === "dark" ? "#0958d9" : "#0958d9",
          // 菜单相关token
          colorBgContainer: currentTheme === "dark" ? "#141414" : "#ffffff",
          colorBgElevated: currentTheme === "dark" ? "#1f1f1f" : "#ffffff",
          colorBgLayout: currentTheme === "dark" ? "#000000" : "#f5f5f5",
          colorBorder: currentTheme === "dark" ? "#303030" : "#d9d9d9",
          colorBorderSecondary: currentTheme === "dark" ? "#262626" : "#f0f0f0",
          colorText: currentTheme === "dark" ? "#ffffff" : "#000000",
          colorTextSecondary: currentTheme === "dark" ? "#a6a6a6" : "#666666",
          // 菜单选中状态
          controlItemBgHover: currentTheme === "dark" ? "#177ddc20" : "#e6f4ff",
          controlItemBgActive:
            currentTheme === "dark" ? "#177ddc40" : "#bae0ff",
          controlItemBgSelected:
            currentTheme === "dark" ? "#177ddc30" : "#e6f4ff",
          controlItemBgSelectedHover:
            currentTheme === "dark" ? "#177ddc50" : "#bae0ff",
        },
        components: {
          Menu: {
            // 菜单组件特定样式
            itemBg: currentTheme === "dark" ? "#141414" : "#ffffff",
            itemSelectedBg: currentTheme === "dark" ? "#177ddc30" : "#e6f4ff",
            itemHoverBg: currentTheme === "dark" ? "#177ddc20" : "#f5f5f5",
            itemActiveBg: currentTheme === "dark" ? "#177ddc40" : "#e6f4ff",
            itemSelectedColor: currentTheme === "dark" ? "#177ddc" : "#1677ff",
            itemColor: currentTheme === "dark" ? "#ffffff" : "#000000",
            itemHoverColor: currentTheme === "dark" ? "#177ddc" : "#1677ff",
            // 子菜单样式
            subMenuItemBg: currentTheme === "dark" ? "#1a1a1a" : "#fafafa",
            darkItemBg: currentTheme === "dark" ? "#141414" : "#ffffff",
            darkItemSelectedBg:
              currentTheme === "dark" ? "#177ddc30" : "#e6f4ff",
            darkItemHoverBg: currentTheme === "dark" ? "#177ddc20" : "#f5f5f5",
          },
        },
      }}
    >
      <Router>
        <AppContent
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
        />
      </Router>
    </ConfigProvider>
  );
}

export default App;
