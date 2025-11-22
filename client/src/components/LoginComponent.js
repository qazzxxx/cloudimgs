import React, { useState, useEffect } from "react";
import { setPassword, clearPassword } from "../utils/secureStorage";
import { Form, Input, Button, Card, message, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";

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
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          borderRadius: "12px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Title level={2} style={{ marginBottom: "8px" }}>
            CloudImgs
          </Title>
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
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入访问密码"
              style={{ borderRadius: "8px" }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                width: "100%",
                borderRadius: "8px",
                height: "40px",
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginComponent;
