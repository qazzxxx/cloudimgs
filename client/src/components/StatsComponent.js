import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Tag,
  Progress,
  Divider,
  Input,
  message,
} from "antd";
import {
  PictureOutlined,
  HddOutlined,
  FolderOutlined,
  CloudOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text } = Typography;

const StatsComponent = () => {
  const [dir, setDir] = useState("");
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchStats = async (targetDir = dir) => {
    setLoading(true);
    try {
      const res = await axios.get("/api/stats", {
        params: targetDir ? { dir: targetDir } : {},
      });
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (e) {
      message.error("获取统计信息失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line
  }, [dir]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStorageUsagePercentage = () => {
    // 假设总存储空间为 1GB (1024 * 1024 * 1024 bytes)
    const totalStorage = 1024 * 1024 * 1024;
    return Math.round(((stats.totalSize || 0) / totalStorage) * 100);
  };

  return (
    <div>
      <Title level={2}>统计信息</Title>
      <Space
        direction="vertical"
        style={{ width: "100%", marginBottom: 16 }}
        size="middle"
      >
        <Input
          placeholder="输入子目录（如 2024/06/10 或 相册/家庭，可留空）"
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="总图片数量"
              value={stats.totalImages || 0}
              prefix={<PictureOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="总存储大小"
              value={formatFileSize(stats.totalSize || 0)}
              prefix={<HddOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="存储使用率"
              value={getStorageUsagePercentage()}
              suffix="%"
              prefix={<CloudOutlined />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="平均图片大小"
              value={
                stats.totalImages > 0
                  ? formatFileSize(
                      Math.round((stats.totalSize || 0) / stats.totalImages)
                    )
                  : "0 Bytes"
              }
              prefix={<FolderOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="存储使用情况" style={{ marginTop: 24 }} loading={loading}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text>存储使用率</Text>
            <Progress
              percent={getStorageUsagePercentage()}
              status={getStorageUsagePercentage() > 80 ? "exception" : "active"}
              strokeColor={{
                "0%": "#108ee9",
                "100%": "#87d068",
              }}
            />
          </div>

          <Divider />

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>存储路径：</Text>
              <br />
              <Text code style={{ fontSize: "12px", wordBreak: "break-all" }}>
                {stats.storagePath || "未配置"}
              </Text>
            </Col>

            <Col span={12}>
              <Text strong>已使用空间：</Text>
              <br />
              <Tag color="blue">{formatFileSize(stats.totalSize || 0)}</Tag>
            </Col>
          </Row>
        </Space>
      </Card>

      <Card title="系统信息" style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Space direction="vertical">
              <div>
                <Text strong>支持格式：</Text>
                <br />
                <Space wrap>
                  <Tag color="green">JPG</Tag>
                  <Tag color="green">PNG</Tag>
                  <Tag color="green">GIF</Tag>
                  <Tag color="green">WebP</Tag>
                  <Tag color="green">BMP</Tag>
                  <Tag color="green">SVG</Tag>
                </Space>
              </div>
            </Space>
          </Col>

          <Col span={12}>
            <Space direction="vertical">
              <div>
                <Text strong>文件限制：</Text>
                <br />
                <Tag color="orange">最大 10MB</Tag>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default StatsComponent;
