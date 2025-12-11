import React from "react";
import { Typography } from "antd";

const { Title } = Typography;

const LogoWithText = ({
  size = 24,
  titleLevel = 3,
  showTitle = true,
  style = {},
  titleStyle = {},
}) => {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    >
      <img
        src={`${process.env.PUBLIC_URL}/favicon.svg`}
        width={size}
        height={size}
        style={{ display: "block" }}
        alt="logo"
      />
      {showTitle && (
        <Title
          level={titleLevel}
          style={{ margin: 0, color: "#1890ff", lineHeight: 1, ...titleStyle }}
        >
          云图
        </Title>
      )}
    </span>
  );
};

export default LogoWithText;
