import React, { useState, useEffect } from "react";
import { ConfigProvider, theme, message, Spin, Grid, Modal } from "antd";
import FloatingToolbar from "./components/FloatingToolbar";
import ImageGallery from "./components/ImageGallery";
import PasswordOverlay from "./components/PasswordOverlay";
import LogoWithText from "./components/LogoWithText";
import api from "./utils/api";
import ApiDocs from "./components/ApiDocs";
import MapPage from "./components/MapPage";
import ShareView from "./components/ShareView";
import DirectorySelector from "./components/DirectorySelector";
import TrafficDashboard from './components/TrafficDashboard';
import { getPassword, clearPassword } from "./utils/secureStorage";

function App() {
  const [currentTheme, setCurrentTheme] = useState("light");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Batch Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Batch Move State
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [targetMoveDir, setTargetMoveDir] = useState("");
  const [moving, setMoving] = useState(false);

  // Simple router check
  const isApiDocs = window.location.pathname === "/opendocs";
  const isMapPage = window.location.pathname === "/map";
  const isTrafficDashboard = window.location.pathname === "/traffic";
  const isShareView = window.location.pathname.startsWith("/share");

  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
    localStorage.setItem("theme", theme);
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setAuthLoading(true);
        const response = await api.get("/auth/status");
        const data = response.data;

        if (data.data?.enabled || data.requiresPassword) {
          setPasswordRequired(true);
          const savedPassword = getPassword();
          if (savedPassword) {
            try {
              await api.post("/auth/login", { password: savedPassword });
              setIsAuthenticated(true);
            } catch (e) {
              clearPassword();
            }
          }
        } else {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    message.success("欢迎回来");
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const toggleBatchMode = () => {
    setIsBatchMode(prev => !prev);
    setSelectedItems(new Set());
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedItems(newSelection);
  };

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) return;

    try {
      const hide = message.loading("正在删除...", 0);
      // Execute deletions in parallel
      const promises = Array.from(selectedItems).map(relPath =>
        api.delete(`/images/${encodeURIComponent(relPath)}`)
      );

      await Promise.all(promises);
      hide();
      message.success(`成功删除 ${selectedItems.size} 张图片`);

      // Reset state
      setSelectedItems(new Set());
      setIsBatchMode(false);
      handleRefresh();
    } catch (error) {
      console.error("Batch delete error:", error);
      message.error("部分图片删除失败，请重试");
      handleRefresh(); // Refresh anyway to show what's left
    }
  };

  const handleBatchMove = () => {
    if (selectedItems.size === 0) return;
    setTargetMoveDir(""); // Reset
    setMoveModalVisible(true);
  };

  const confirmBatchMove = async () => {
    if (selectedItems.size === 0) return;

    setMoving(true);
    try {
      const res = await api.post("/batch/move", {
        files: Array.from(selectedItems),
        targetDir: targetMoveDir
      });

      if (res.data.success) {
        message.success(res.data.message || "移动成功");
        setMoveModalVisible(false);
        setSelectedItems(new Set());
        setIsBatchMode(false);
        handleRefresh();
      } else {
        message.error(res.data.error || "移动失败");
      }
    } catch (e) {
      message.error("移动失败，请重试");
    } finally {
      setMoving(false);
    }
  };

  // Global styles for glassmorphism and background
  const globalStyles = `
    body {
      margin: 0;
      padding: 0;
      background: ${currentTheme === 'dark' ? '#0f0f0f' : '#f5f7fa'};
      transition: background 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: ${currentTheme === 'dark' ? '#333' : '#ccc'};
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: ${currentTheme === 'dark' ? '#555' : '#999'};
    }
    
    /* Prevent dropdown scroll from affecting main page */
    .directory-selector-dropdown .rc-virtual-list-holder {
      overflow-y: auto !important;
      overscroll-behavior: contain;
    }

    /* Force fix for Filerobot Image Editor Input Background */
    .SfxInput-root {
      background-color: ${currentTheme === 'dark' ? '#141414' : '#ffffff'} !important;
    }
  `;

  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 12,
        },
      }}
    >
      <style>{globalStyles}</style>

      {/* Main Content */}
      <div style={{ position: "relative", minHeight: "100vh" }}>
        {isApiDocs ? (
          <ApiDocs />
        ) : isMapPage ? (
          <MapPage />
        ) : isTrafficDashboard ? (
          <TrafficDashboard />
        ) : isShareView ? (
          <ShareView currentTheme={currentTheme} onThemeChange={handleThemeChange} />
        ) : authLoading ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            gap: 20
          }}>
            <LogoWithText />
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* Waterfall Gallery */}
            {/* Only render gallery if authenticated or if no password required, 
                OR render it but it might be empty if API blocks it. 
                We'll render it but PasswordOverlay will cover it. */}
            <ImageGallery
              api={api}
              onRefresh={handleRefresh}
              refreshTrigger={refreshTrigger}
              isAuthenticated={!passwordRequired || isAuthenticated}
              isBatchMode={isBatchMode}
              selectedItems={selectedItems}
              onSelectionChange={handleSelectionChange}
            />

            {/* Password Overlay */}
            {passwordRequired && !isAuthenticated && (
              <PasswordOverlay
                onLoginSuccess={handleLoginSuccess}
                isMobile={isMobile}
              />
            )}

            {/* Floating Toolbar - Only show when authenticated */}
            {(!passwordRequired || isAuthenticated) && (
              <FloatingToolbar
                onThemeChange={handleThemeChange}
                currentTheme={currentTheme}
                onRefresh={handleRefresh}
                api={api}
                isMobile={isMobile}
                isBatchMode={isBatchMode}
                toggleBatchMode={toggleBatchMode}
                selectedCount={selectedItems.size}
                onBatchDelete={handleBatchDelete}
                onBatchMove={handleBatchMove}
              />
            )}

            {/* Batch Move Modal */}
            <Modal
              open={moveModalVisible}
              title="移动到..."
              onCancel={() => setMoveModalVisible(false)}
              onOk={confirmBatchMove}
              confirmLoading={moving}
              okText="确认移动"
              cancelText="取消"
              destroyOnClose
            >
              <div style={{ padding: "20px 0" }}>
                <p style={{ marginBottom: 12 }}>将选中的 {selectedItems.size} 张图片移动到：</p>
                <DirectorySelector
                  value={targetMoveDir}
                  onChange={setTargetMoveDir}
                  api={api}
                  allowInput={true}
                  placeholder="选择或输入目标相册"
                />
              </div>
            </Modal>
          </>
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
