import React from "react";

const Logo = ({ size = 24, style = {} }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={style}
    >
      {/* 背景圆形 */}
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="#1890ff"
        stroke="#096dd9"
        strokeWidth="2"
      />

      {/* 云朵 */}
      <path
        d="M20 28c0-4.4 3.6-8 8-8 1.2 0 2.4 0.3 3.4 0.8C33.2 18.4 36.8 16 41 16c5.5 0 10 4.5 10 10 0 0.6-0.1 1.2-0.2 1.8C52.8 29.2 56 32.8 56 37c0 4.4-3.6 8-8 8H20c-4.4 0-8-3.6-8-8s3.6-8 8-8z"
        fill="white"
        opacity="0.9"
      />

      {/* 图片图标 */}
      <rect
        x="24"
        y="24"
        width="16"
        height="12"
        rx="2"
        fill="white"
        stroke="#1890ff"
        strokeWidth="1.5"
      />
      <circle cx="28" cy="28" r="1.5" fill="#1890ff" />
      <path d="M24 34l3-3 2 2 3-3 4 4v2H24v-2z" fill="#1890ff" />

      {/* 装饰性元素 */}
      <circle cx="48" cy="20" r="2" fill="#52c41a" opacity="0.8" />
      <circle cx="16" cy="44" r="1.5" fill="#faad14" opacity="0.8" />
    </svg>
  );
};

export default Logo;
