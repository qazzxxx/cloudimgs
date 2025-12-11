import React, { useState, useEffect, useCallback } from "react";
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
  LogoutOutlined,
  ScissorOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import UploadComponent from "./components/UploadComponent";
import ImageGallery from "./components/ImageGallery";
import StatsComponent from "./components/StatsComponent";
import SvgToPngTool from "./components/SvgToPngTool";
import ImageCompressor from "./components/ImageCompressor";
import LogoWithText from "./components/LogoWithText";
import ThemeSwitcher from "./components/ThemeSwitcher";
import LoginComponent from "./components/LoginComponent";
import ImageCropperTool from "./components/ImageCropperTool";
import ApiDocsComponent from "./components/ApiDocsComponent";
import api from "./utils/api";
import { getPassword, clearPassword } from "./utils/secureStorage";

const { Header, Content, Sider } = Layout;

// 主应用组件
function AppContent({ currentTheme, onThemeChange }) {
  const [selectedKey, setSelectedKey] = useState("upload");
  const [openKeys, setOpenKeys] = useState([]);
  const [stats, setStats] = useState({});
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();

  const {
    token: { colorBgContainer, borderRadiusLG, colorBorder },
  } = theme.useToken();

  // 判断是否为移动端
  const isMobile = !screens.md;

  // 检查是否需要密码保护
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setAuthLoading(true);
        const response = await fetch("/api/auth/status");
        const data = await response.json();

        if (data.requiresPassword) {
          setPasswordRequired(true);
          const savedPassword = getPassword();
          if (savedPassword) {
            // 验证保存的密码是否有效
            const verifyResponse = await fetch("/api/auth/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ password: savedPassword }),
            });

            if (verifyResponse.ok) {
              setIsAuthenticated(true);
            } else {
              clearPassword();
            }
          }
        } else {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("检查认证状态失败:", error);
        // 如果检查失败，假设不需要密码，但不要自动认证
        // 这样可以避免死循环
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // 登录成功处理
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  // 登出处理
  const handleLogout = () => {
    clearPassword();
    setIsAuthenticated(false);
    message.success("已退出登录");
  };

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
    } else if (path === "/api-docs") {
      setSelectedKey("api-docs");
      setOpenKeys([]);
    } else if (path === "/svg-tool") {
      setSelectedKey("svg-tool");
      setOpenKeys(["tools"]);
    } else if (path === "/compressor") {
      setSelectedKey("compressor");
      setOpenKeys(["tools"]);
    } else if (path === "/cropper") {
      setSelectedKey("cropper");
      setOpenKeys(["tools"]);
    }
  }, [location.pathname]);

  // 获取统计信息
  const fetchStats = useCallback(async () => {
    // 只有在已认证的情况下才获取数据
    if (!isAuthenticated) return;

    try {
      const response = await api.get("/stats");
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("获取统计信息失败:", error);
      console.error("Error details:", error.response?.data);
    }
  }, [isAuthenticated]);

  // 获取图片列表
  const fetchImages = useCallback(async () => {
    // 只有在已认证的情况下才获取数据
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const response = await api.get("/images");
      if (response.data.success) {
        setImages(response.data.data);
      }
    } catch (error) {
      console.error("获取图片列表失败:", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // 删除图片
  const handleDeleteImage = async (filename) => {
    try {
      await api.delete(`/images/${filename}`);
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
      case "api-docs":
        navigate("/api-docs");
        break;
      case "svg-tool":
        navigate("/svg-tool");
        break;
      case "compressor":
        navigate("/compressor");
        break;
      case "cropper":
        navigate("/cropper");
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
    // 只有在已认证的情况下才获取数据
    if (isAuthenticated && !authLoading) {
      fetchStats();
      fetchImages();
    }
  }, [isAuthenticated, authLoading, fetchStats, fetchImages]);

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
        {
          key: "cropper",
          icon: <ScissorOutlined />,
          label: "图片裁剪",
        },
      ],
    },
    {
      key: "api-docs",
      icon: <ApiOutlined />,
      label: "开放接口",
    },
  ];

  // 在认证加载期间显示加载状态
  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div style={{ textAlign: "center", color: "white" }}>
          <div style={{ fontSize: "24px", marginBottom: "16px" }}>
            云图
          </div>
          <div>正在检查认证状态...</div>
        </div>
      </div>
    );
  }

  // 如果不需要密码保护或已认证，显示主应用
  if (!passwordRequired || isAuthenticated) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <Sider
            width={250}
            style={{
              background: colorBgContainer,
              borderRight: `1px solid ${colorBorder}`,
            }}
          >
            <div style={{ padding: "16px", textAlign: "center" }}>
              <LogoWithText />
            </div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              openKeys={openKeys}
              onOpenChange={handleOpenChange}
              onClick={handleMenuClick}
              items={menuItems}
              style={{
                borderRight: 0,
                height: "calc(100vh - 80px)",
                overflowY: "auto",
              }}
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
            width={250}
          >
            <div style={{ marginBottom: "16px", textAlign: "center" }}>
              <LogoWithText />
            </div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              openKeys={openKeys}
              onOpenChange={handleOpenChange}
              onClick={handleMobileMenuClick}
              items={menuItems}
              style={{ borderRight: 0 }}
            />
          </Drawer>
        )}

        <Layout>
          {/* 头部 */}
          <Header
            style={{
              padding: "0 16px",
              background: colorBgContainer,
              borderBottom: `1px solid ${colorBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              {isMobile && (
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => setMobileMenuOpen(true)}
                  style={{ marginRight: "16px" }}
                />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <ThemeSwitcher
                theme={currentTheme}
                onThemeChange={onThemeChange}
              />
              {passwordRequired && (
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  style={{
                    color: currentTheme === "dark" ? "#ffffff" : "#000000",
                  }}
                  size={isMobile ? "small" : "middle"}
                >
                  <span style={{ display: isMobile ? "none" : "inline" }}>
                    退出登录
                  </span>
                </Button>
              )}
            </div>
          </Header>

          {/* 内容区域 */}
          <Content
            style={{
              margin: "16px",
              padding: "24px",
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              minHeight: "calc(100vh - 120px)",
            }}
          >
            <Routes>
              <Route
                path="/"
                element={
                  <UploadComponent
                    onUploadSuccess={handleUploadSuccess}
                    api={api}
                  />
                }
              />
              <Route
                path="/upload"
                element={
                  <UploadComponent
                    onUploadSuccess={handleUploadSuccess}
                    api={api}
                  />
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
                    api={api}
                  />
                }
              />
              <Route
                path="/stats"
                element={<StatsComponent stats={stats} api={api} />}
              />
              <Route
                path="/api-docs"
                element={<ApiDocsComponent currentTheme={currentTheme} />}
              />
              <Route path="/svg-tool" element={<SvgToPngTool api={api} />} />
              <Route
                path="/compressor"
                element={<ImageCompressor api={api} />}
              />
              <Route path="/cropper" element={<ImageCropperTool api={api} />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    );
  }

  // 如果需要密码保护且未认证，显示登录界面
  return <LoginComponent onLoginSuccess={handleLoginSuccess} />;
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
            // 子菜单样式 - 修复暗黑模式下的背景色
            subMenuItemBg: currentTheme === "dark" ? "#141414" : "#fafafa",
            darkItemBg: currentTheme === "dark" ? "#141414" : "#ffffff",
            darkItemSelectedBg:
              currentTheme === "dark" ? "#177ddc30" : "#e6f4ff",
            darkItemHoverBg: currentTheme === "dark" ? "#177ddc20" : "#f5f5f5",
            // 子菜单展开时的背景色
            darkSubMenuItemBg: currentTheme === "dark" ? "#141414" : "#fafafa",
            // 确保子菜单背景色一致
            popupBg: currentTheme === "dark" ? "#141414" : "#ffffff",
            darkPopupBg: currentTheme === "dark" ? "#141414" : "#ffffff",
          },
        },
      }}
    >
      {/* 全局样式重置 */}
      <style>
        {`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          html {
            margin: 0;
            padding: 0;
          }
          
          #root {
            margin: 0;
            padding: 0;
          }
          
          .ant-menu-submenu-popup .ant-menu {
            background-color: ${
              currentTheme === "dark" ? "#141414" : "#ffffff"
            } !important;
          }
          .ant-menu-submenu-popup .ant-menu-item {
            background-color: ${
              currentTheme === "dark" ? "#141414" : "#ffffff"
            } !important;
          }
          .ant-menu-submenu-popup .ant-menu-item:hover {
            background-color: ${
              currentTheme === "dark" ? "#177ddc20" : "#f5f5f5"
            } !important;
          }
          .ant-menu-submenu-popup .ant-menu-item-selected {
            background-color: ${
              currentTheme === "dark" ? "#177ddc30" : "#e6f4ff"
            } !important;
          }
        `}
      </style>
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
