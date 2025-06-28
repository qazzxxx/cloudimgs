import React from "react";
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
} from "antd";
import {
  PictureOutlined,
  HddOutlined,
  FolderOutlined,
  CloudOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const StatsComponent = ({ stats }) => {
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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总图片数量"
              value={stats.totalImages || 0}
              prefix={<PictureOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总存储大小"
              value={formatFileSize(stats.totalSize || 0)}
              prefix={<HddOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
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
          <Card>
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

      <Card title="存储使用情况" style={{ marginTop: 24 }}>
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

      <Card title="API 接口说明" style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text strong>上传图片：</Text>
            <br />
            <Text code>POST /api/upload</Text>
            <br />
            <Text type="secondary">
              使用 multipart/form-data 格式，字段名为 image
            </Text>
          </div>

          <Divider />

          <div>
            <Text strong>获取随机图片：</Text>
            <br />
            <Text code>GET /api/random</Text>
            <br />
            <Text type="secondary">返回随机一张图片的信息</Text>
          </div>

          <Divider />

          <div>
            <Text strong>获取图片列表：</Text>
            <br />
            <Text code>GET /api/images</Text>
            <br />
            <Text type="secondary">返回所有图片的列表信息</Text>
          </div>

          <Divider />

          <div>
            <Text strong>获取统计信息：</Text>
            <br />
            <Text code>GET /api/stats</Text>
            <br />
            <Text type="secondary">返回存储统计信息</Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default StatsComponent;
