import React, { useState, useEffect } from "react";
import { ConfigProvider, theme, message, Spin, Grid } from "antd";
import FloatingToolbar from "./components/FloatingToolbar";
import ImageGallery from "./components/ImageGallery";
import PasswordOverlay from "./components/PasswordOverlay";
import LogoWithText from "./components/LogoWithText";
import api from "./utils/api";
import ApiDocs from "./components/ApiDocs";
import { getPassword, clearPassword } from "./utils/secureStorage";

function App() {
  const [currentTheme, setCurrentTheme] = useState("light");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Simple router check
  const isApiDocs = window.location.pathname === "/api/docs";
  
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
        const response = await fetch("/api/auth/status");
        const data = await response.json();

        if (data.requiresPassword) {
          setPasswordRequired(true);
          const savedPassword = getPassword();
          if (savedPassword) {
            const verifyResponse = await fetch("/api/auth/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
                key={refreshTrigger} // Force re-render/fetch on refresh
                isAuthenticated={!passwordRequired || isAuthenticated}
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
              />
            )}
          </>
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
