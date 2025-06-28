import React, { useState } from "react";
import {
  Card,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Modal,
  message,
  Popconfirm,
  Tag,
  Input,
  Empty,
  Spin,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  CopyOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import LogoWithText from "./LogoWithText";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Search } = Input;

const ImageGallery = ({ images, loading, onDelete, onRefresh }) => {
  const [searchText, setSearchText] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handlePreview = (file) => {
    setPreviewImage(file.url);
    setPreviewVisible(true);
    setPreviewTitle(file.filename);
  };

  const handleDownload = (file) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("开始下载");
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success("链接已复制到剪贴板");
    });
  };

  const handleDelete = async (filename) => {
    try {
      await onDelete(filename);
      message.success("删除成功");
    } catch (error) {
      message.error("删除失败");
    }
  };

  const filteredImages = images.filter((image) =>
    image.filename.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={2}>图片管理</Title>
        <Space>
          <Search
            placeholder="搜索图片名称"
            allowClear
            style={{ width: 300 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>加载中...</div>
        </div>
      ) : filteredImages.length === 0 ? (
        <Empty description="暂无图片" style={{ marginTop: 50 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredImages.map((image, index) => (
            <Col xs={24} sm={12} md={8} lg={6} xl={4} key={index}>
              <Card
                hoverable
                cover={
                  <div style={{ position: "relative" }}>
                    <img
                      alt={image.filename}
                      src={image.url}
                      style={{
                        height: 200,
                        width: "100%",
                        objectFit: "cover",
                        cursor: "pointer",
                      }}
                      onClick={() => handlePreview(image)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.6)",
                        borderRadius: "4px",
                        padding: "2px 6px",
                      }}
                    >
                      <Text style={{ color: "white", fontSize: "12px" }}>
                        {formatFileSize(image.size)}
                      </Text>
                    </div>
                  </div>
                }
                actions={[
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(image)}
                    title="预览"
                  />,
                  <Button
                    type="text"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(image)}
                    title="下载"
                  />,
                  <Button
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() =>
                      copyToClipboard(`${window.location.origin}${image.url}`)
                    }
                    title="复制链接"
                  />,
                  <Popconfirm
                    title="确定要删除这张图片吗？"
                    onConfirm={() => handleDelete(image.filename)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      title="删除"
                    />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={
                    <Text ellipsis style={{ maxWidth: "100%" }}>
                      {image.filename}
                    </Text>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {dayjs(image.uploadTime).format("YYYY-MM-DD HH:mm:ss")}
                      </Text>
                      <Tag color="blue">{formatFileSize(image.size)}</Tag>
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width="80%"
        style={{ top: 20 }}
      >
        <img alt="preview" style={{ width: "100%" }} src={previewImage} />
      </Modal>
    </div>
  );
};

export default ImageGallery;
