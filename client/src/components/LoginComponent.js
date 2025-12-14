import React, { useState, useEffect } from "react";
import { setPassword, clearPassword } from "../utils/secureStorage";
import { Form, Input, Button, Card, message, Typography, Space } from "antd";
import { LockOutlined } from "@ant-design/icons";
import LogoWithText from "./LogoWithText";

const { Title, Text } = Typography;

const LoginComponent = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);

  // 防止页面滚动并重置body margin
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalMargin = document.body.style.margin;
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    return () => {
      document.body.style.overflow = originalOverflow || "auto";
      document.body.style.margin = originalMargin || "";
    };
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 将密码加密后存储，用于后续API调用
      setPassword(values.password);

      // 测试密码是否正确
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: values.password }),
      });

      if (response.ok) {
        message.success("登录成功！");
        onLoginSuccess();
      } else {
        const errorData = await response.json();
        message.error(errorData.error || "密码错误");
        clearPassword();
      }
    } catch (error) {
      console.error("登录失败:", error);
      message.error("登录失败，请检查网络连接");
      clearPassword();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes float1 { 0% { transform: translateY(0); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0); } }
        @keyframes float2 { 0% { transform: translateY(0); } 50% { transform: translateY(10px); } 100% { transform: translateY(0); } }
        @keyframes float3 { 0% { transform: translateY(0); } 50% { transform: translateY(-6px); } 100% { transform: translateY(0); } }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <div
          style={{
            position: "absolute",
            left: "-60px",
            top: "-60px",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(142,197,252,0.25), rgba(142,197,252,0))",
            filter: "blur(6px)",
            animation: "float1 8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "-80px",
            bottom: "-80px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(224,195,252,0.22), rgba(224,195,252,0))",
            filter: "blur(8px)",
            animation: "float2 10s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "20%",
            transform: "translateX(-50%)",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(161,196,253,0.18), rgba(161,196,253,0))",
            filter: "blur(5px)",
            animation: "float3 9s ease-in-out infinite",
          }}
        />
      </div>
      <Space direction="vertical" align="center" size="large" style={{ width: "100%" }}>
        <LogoWithText />
        <Card
          style={{
            width: 420,
            maxWidth: "92vw",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.06)",
            borderRadius: "12px",
            backdropFilter: "saturate(1.1)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <Text type="secondary">请输入访问密码</Text>
          </div>
          <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
            <Form.Item
              name="password"
              rules={[
                {
                  required: true,
                  message: "请输入密码！",
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入访问密码" style={{ borderRadius: "8px" }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} style={{ width: "100%", borderRadius: "8px", height: "40px" }}>
                登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};

export default LoginComponent;
