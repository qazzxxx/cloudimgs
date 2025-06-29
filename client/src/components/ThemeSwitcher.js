import React, { useState, useEffect } from "react";
import { Button, Dropdown } from "antd";
import { SunOutlined, MoonOutlined, SyncOutlined } from "@ant-design/icons";

const THEME_KEY = "theme";
const AUTO_KEY = "themeAutoMode";

const ThemeSwitcher = ({ theme, onThemeChange }) => {
  const [autoMode, setAutoMode] = useState(false);

  // 加载自动模式
  useEffect(() => {
    const savedAutoMode = localStorage.getItem(AUTO_KEY);
    if (savedAutoMode !== null) {
      setAutoMode(JSON.parse(savedAutoMode));
    }
  }, []);

  // 自动模式定时器
  useEffect(() => {
    if (!autoMode) return;
    const checkTimeAndUpdateTheme = () => {
      const hour = new Date().getHours();
      const shouldBeDark = hour < 6 || hour >= 18;
      const newTheme = shouldBeDark ? "dark" : "light";
      if (theme !== newTheme) {
        onThemeChange(newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
      }
    };
    checkTimeAndUpdateTheme();
    const interval = setInterval(checkTimeAndUpdateTheme, 60000);
    return () => clearInterval(interval);
  }, [autoMode, theme, onThemeChange]);

  // 菜单点击
  const handleMenuClick = ({ key }) => {
    if (key === "auto") {
      setAutoMode(true);
      localStorage.setItem(AUTO_KEY, "true");
      // 立即切换一次
      const hour = new Date().getHours();
      const shouldBeDark = hour < 6 || hour >= 18;
      const newTheme = shouldBeDark ? "dark" : "light";
      onThemeChange(newTheme);
      localStorage.setItem(THEME_KEY, newTheme);
    } else {
      setAutoMode(false);
      localStorage.setItem(AUTO_KEY, "false");
      onThemeChange(key);
      localStorage.setItem(THEME_KEY, key);
    }
  };

  // 当前高亮
  const selectedKey = autoMode ? "auto" : theme;

  const items = [
    {
      key: "light",
      icon: (
        <SunOutlined
          style={{ color: selectedKey === "light" ? "#1677ff" : undefined }}
        />
      ),
      label: (
        <span
          style={{ color: selectedKey === "light" ? "#1677ff" : undefined }}
        >
          浅色主题
        </span>
      ),
    },
    {
      key: "dark",
      icon: (
        <MoonOutlined
          style={{ color: selectedKey === "dark" ? "#1677ff" : undefined }}
        />
      ),
      label: (
        <span style={{ color: selectedKey === "dark" ? "#1677ff" : undefined }}>
          暗色主题
        </span>
      ),
    },
    {
      key: "auto",
      icon: (
        <SyncOutlined
          style={{ color: selectedKey === "auto" ? "#1677ff" : undefined }}
        />
      ),
      label: (
        <span style={{ color: selectedKey === "auto" ? "#1677ff" : undefined }}>
          自动切换
        </span>
      ),
    },
  ];

  const getThemeIcon = () => {
    if (autoMode) return <SyncOutlined />;
    return theme === "dark" ? <MoonOutlined /> : <SunOutlined />;
  };
  const getThemeText = () => {
    if (autoMode) return "自动切换";
    return theme === "dark" ? "暗色主题" : "浅色主题";
  };

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [selectedKey],
        onClick: handleMenuClick,
      }}
      placement="bottomRight"
      trigger={["click"]}
    >
      <Button type="text" icon={getThemeIcon()} style={{ color: "inherit" }}>
        {getThemeText()}
      </Button>
    </Dropdown>
  );
};

export default ThemeSwitcher;
