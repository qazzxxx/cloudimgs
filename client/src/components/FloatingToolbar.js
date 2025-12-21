import React, { useState } from "react";
import { Modal, Tooltip, theme, Button } from "antd";
import {
  CloudUploadOutlined,
  ReloadOutlined,
  SunOutlined,
  MoonOutlined,
} from "@ant-design/icons";
import UploadComponent from "./UploadComponent";

const FloatingToolbar = ({
  onThemeChange,
  currentTheme,
  onRefresh,
  api,
  isMobile,
}) => {
  const [uploadVisible, setUploadVisible] = useState(false);
  const { token } = theme.useToken();
  
  // Infer dark mode
  const isDarkMode = currentTheme === "dark";

  const handleUploadSuccess = () => {
    setUploadVisible(false);
    if (onRefresh) {
      onRefresh();
    }
  };

  const buttonStyle = {
    background: "transparent",
    border: "none",
    color: isDarkMode ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)",
    boxShadow: "none",
    width: 32,
    height: 32,
    minWidth: 32,
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 6, // Reduced gap
          background: isDarkMode ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "6px 10px", // Reduced padding
          borderRadius: "100px",
          boxShadow: isDarkMode 
            ? "0 8px 32px rgba(0, 0, 0, 0.4)" 
            : "0 8px 32px rgba(0, 0, 0, 0.1)",
          border: `1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.4)"}`,
          zIndex: 1000,
          transition: "all 0.3s ease",
        }}
      >
        <Tooltip title="刷新列表" placement="top">
          <Button 
            shape="circle" 
            icon={<ReloadOutlined />} 
            onClick={onRefresh} 
            size="middle" // Reduced size
            type="text"
            style={buttonStyle}
            className="toolbar-btn"
          />
        </Tooltip>
        
        <div style={{ width: 1, height: 16, background: isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }} />

        <Tooltip title={isDarkMode ? "切换亮色" : "切换暗色"} placement="top">
          <Button
            shape="circle"
            icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
            onClick={() =>
              onThemeChange(isDarkMode ? "light" : "dark")
            }
            size="middle" // Reduced size
            type="text"
            style={buttonStyle}
            className="toolbar-btn"
          />
        </Tooltip>

        {isMobile && (
          <>
            <div style={{ width: 1, height: 16, background: isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }} />

            <Tooltip title="上传图片" placement="top">
              <Button
                shape="circle"
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={() => setUploadVisible(true)}
                size="middle"
                className="upload-btn"
                style={{
                    width: 32,
                    height: 32,
                    minWidth: 32,
                    fontSize: 16,
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
              />
            </Tooltip>
          </>
        )}
      </div>

      <style>{`
        .toolbar-btn {
          transition: background-color 0.3s ease !important;
        }
        .toolbar-btn:hover {
          background-color: ${isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)"} !important;
        }
        
        .upload-btn {
          background-color: ${token.colorPrimary} !important;
          transition: filter 0.3s ease, transform 0.3s ease !important;
        }
        .upload-btn:hover {
          filter: brightness(1.1);
          transform: scale(1.05);
        }
      `}</style>

      <Modal
        open={uploadVisible}
        title={null}
        footer={null}
        onCancel={() => setUploadVisible(false)}
        width={isMobile ? "90%" : 600}
        centered
        modalRender={(modal) => (
            <div style={{ 
                background: isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: 24,
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
                border: `1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.4)"}`,
                padding: 0,
                overflow: 'hidden'
            }}>
                {modal}
            </div>
        )}
        styles={{
            content: {
                background: 'transparent',
                boxShadow: 'none',
                padding: 0,
            },
            body: {
                padding: 0,
            }
        }}
        destroyOnClose
        closeIcon={null}
      >
        <div style={{ position: 'relative' }}>
             {/* Custom close button since we removed the default one */}
             <Button 
                type="text" 
                shape="circle" 
                onClick={() => setUploadVisible(false)}
                style={{ 
                    position: 'absolute', 
                    right: 12, 
                    top: 12, 
                    zIndex: 10,
                    color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' 
                }}
             >
                 ✕
             </Button>
            <UploadComponent onUploadSuccess={handleUploadSuccess} api={api} isModal={true} />
        </div>
      </Modal>
    </>
  );
};

export default FloatingToolbar;
