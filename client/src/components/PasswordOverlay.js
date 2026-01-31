import React, { useState } from "react";
import { Form, Input, Button, message, Typography } from "antd";
import { LockOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { setPassword, clearPassword } from "../utils/secureStorage";
import ScrollingBackground from "./ScrollingBackground";
import api from "../utils/api";

const { Text, Title } = Typography;

const PasswordOverlay = ({ onLoginSuccess, isMobile }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      setPassword(values.password);
      await api.post("/auth/login", { password: values.password });
      onLoginSuccess();
    } catch (error) {
      console.error("验证失败:", error);
      const errorMsg = error.response?.data?.error || "验证失败";
      message.error(errorMsg);
      clearPassword();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000", // Dark base
        overflow: "hidden",
      }}
    >
      {/* Dynamic Background */}
      <ScrollingBackground />

      {/* Glassmorphism Overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.4)", // Darkening overlay
          backdropFilter: "blur(10px)", // Global blur for the background
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 1,
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: isMobile ? "85%" : "380px",
          padding: "40px",
          borderRadius: "24px",
          background: "rgba(255, 255, 255, 0.1)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          textAlign: "center",
          zIndex: 2,
          position: "relative",
          transform: "translateY(-20px)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <LockOutlined
            style={{
              fontSize: "28px",
              color: "#fff",
            }}
          />
        </div>

        <Title level={3} style={{ color: "#fff", marginBottom: 8, marginTop: 0 }}>
          云图 - 云端一隅，拾光深藏
        </Title>
        <Text
          style={{
            display: "block",
            marginBottom: "32px",
            fontSize: "14px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          请输入访问密码以继续
        </Text>

        <Form name="password-protect" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="password"
            rules={[{ required: true, message: "" }]}
            style={{ marginBottom: "24px" }}
          >
            <Input.Password
              placeholder="密码"
              bordered={false}
              size="large"
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: "12px",
                padding: "10px 16px",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
                textAlign: "center",
                fontSize: "16px",
                letterSpacing: "2px",
              }}
              className="password-input"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              shape="round"
              size="large"
              icon={<ArrowRightOutlined />}
              style={{
                width: "100%",
                height: "48px",
                background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                border: "none",
                color: "#333",
                fontWeight: "bold",
                fontSize: "16px",
                boxShadow: "0 4px 15px rgba(255,255,255,0.2)",
              }}
            >
              解锁进入
            </Button>
          </Form.Item>
        </Form>
      </div>

      <style>{`
        .password-input input {
            color: #fff !important;
            text-align: center;
        }
        .password-input input::placeholder {
            color: rgba(255,255,255,0.3);
            letter-spacing: normal;
        }
      `}</style>
    </div>
  );
};

export default PasswordOverlay;
