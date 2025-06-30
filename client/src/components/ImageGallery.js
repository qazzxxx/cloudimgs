import React, { useState, useEffect } from "react";
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
  Grid,
  theme,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  CopyOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import DirectorySelector from "./DirectorySelector";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Search } = Input;

const ImageGallery = ({ onDelete, onRefresh, api }) => {
  const {
    token: { colorBgContainer, colorBorder },
  } = theme.useToken();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [searchText, setSearchText] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [dir, setDir] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = async (targetDir = dir) => {
    setLoading(true);
    try {
      const res = await api.get("/images", {
        params: targetDir ? { dir: targetDir } : {},
      });
      if (res.data.success) {
        setImages(res.data.data);
      }
    } catch (e) {
      message.error("获取图片列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line
  }, [dir]);

  const handleDelete = async (relPath) => {
    try {
      await api.delete(`/images/${encodeURIComponent(relPath)}`);
      message.success("删除成功");
      fetchImages();
      if (onDelete) {
        onDelete(relPath);
      }
    } catch (error) {
      message.error("删除失败");
    }
  };

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

  const filteredImages = images.filter((image) =>
    image.filename.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: isMobile ? "flex-start" : "space-between",
          alignItems: isMobile ? "stretch" : "center",
          marginBottom: isMobile ? 16 : 24,
          gap: isMobile ? 12 : 0,
        }}
      >
        <Title level={isMobile ? 3 : 2}>图片管理</Title>
        <Space
          direction={isMobile ? "vertical" : "horizontal"}
          style={{ width: isMobile ? "100%" : "auto" }}
          size={isMobile ? "small" : "middle"}
        >
          <DirectorySelector
            value={dir}
            onChange={setDir}
            placeholder="选择或输入子目录"
            style={{ width: isMobile ? "100%" : 260 }}
            allowInput={false}
            api={api}
          />
          <Search
            placeholder="搜索图片名称"
            allowClear
            style={{ width: isMobile ? "100%" : 200 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchImages()}
            loading={loading}
            style={{ width: isMobile ? "100%" : "auto" }}
          >
            {isMobile ? "刷新列表" : "刷新"}
          </Button>
        </Space>
      </div>

      {/* 目录信息展示 */}
      {dir && (
        <div
          style={{
            background: colorBgContainer,
            border: `1px solid ${colorBorder}`,
            borderRadius: "6px",
            padding: isMobile ? "8px 12px" : "12px 16px",
            marginBottom: isMobile ? "12px" : "16px",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? "4px" : "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FolderOutlined style={{ color: "#586069" }} />
            <Text
              type="secondary"
              style={{ fontSize: isMobile ? "13px" : "14px" }}
            >
              当前目录：
            </Text>
            <Tag color="blue" style={{ fontSize: isMobile ? "12px" : "13px" }}>
              {dir}
            </Tag>
          </div>
          <Text
            type="secondary"
            style={{
              fontSize: isMobile ? "11px" : "12px",
              marginLeft: isMobile ? "0" : "auto",
            }}
          >
            共 {filteredImages.length} 张图片
          </Text>
        </div>
      )}

      {loading ? (
        <div
          style={{ textAlign: "center", padding: isMobile ? "30px" : "50px" }}
        >
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: isMobile ? "14px" : "16px" }}>
            加载中...
          </div>
        </div>
      ) : filteredImages.length === 0 ? (
        <Empty
          description="暂无图片"
          style={{ marginTop: isMobile ? 30 : 50 }}
        />
      ) : (
        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
          {filteredImages.map((image, index) => (
            <Col xs={24} sm={12} md={8} lg={6} xl={4} key={index}>
              <Card
                hoverable
                size={isMobile ? "small" : "default"}
                cover={
                  <div style={{ position: "relative" }}>
                    <img
                      alt={image.filename}
                      src={image.url}
                      style={{
                        height: isMobile ? 150 : 200,
                        width: "100%",
                        objectFit: "cover",
                        cursor: "pointer",
                      }}
                      onClick={() => handlePreview(image)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: isMobile ? 4 : 8,
                        right: isMobile ? 4 : 8,
                        background: "rgba(0,0,0,0.6)",
                        borderRadius: "4px",
                        padding: isMobile ? "1px 4px" : "2px 6px",
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontSize: isMobile ? "10px" : "12px",
                        }}
                      >
                        {formatFileSize(image.size)}
                      </Text>
                    </div>
                  </div>
                }
                actions={[
                  <Button
                    type="text"
                    size={isMobile ? "small" : "middle"}
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(image)}
                    title="预览"
                  />,
                  <Button
                    type="text"
                    size={isMobile ? "small" : "middle"}
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(image)}
                    title="下载"
                  />,
                  <Button
                    type="text"
                    size={isMobile ? "small" : "middle"}
                    icon={<CopyOutlined />}
                    onClick={() =>
                      copyToClipboard(`${window.location.origin}${image.url}`)
                    }
                    title="复制链接"
                  />,
                  <Popconfirm
                    title="确定要删除这张图片吗？"
                    onConfirm={() => handleDelete(image.relPath)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      size={isMobile ? "small" : "middle"}
                      danger
                      icon={<DeleteOutlined />}
                      title="删除"
                    />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={
                    <Text
                      ellipsis
                      style={{
                        maxWidth: "100%",
                        fontSize: isMobile ? "13px" : "14px",
                      }}
                    >
                      {image.filename}
                    </Text>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      {/* 子目录显示 */}
                      {image.relPath && image.relPath.includes("/") && (
                        <Text
                          type="secondary"
                          style={{ fontSize: isMobile ? "11px" : "12px" }}
                        >
                          <span
                            style={{
                              background: colorBgContainer,
                              border: `1px solid ${colorBorder}`,
                              borderRadius: 4,
                              padding: isMobile ? "1px 4px" : "2px 6px",
                              marginRight: 4,
                            }}
                          >
                            {image.relPath.substring(
                              0,
                              image.relPath.lastIndexOf("/")
                            )}
                          </span>
                        </Text>
                      )}
                      <Text
                        type="secondary"
                        style={{ fontSize: isMobile ? "11px" : "12px" }}
                      >
                        {dayjs(image.uploadTime).format("YYYY-MM-DD HH:mm:ss")}
                      </Text>
                      <Tag
                        color="blue"
                        style={{ fontSize: isMobile ? "11px" : "12px" }}
                      >
                        {formatFileSize(image.size)}
                      </Tag>
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
        width={isMobile ? "95%" : "80%"}
        style={{
          top: isMobile ? 10 : 20,
          maxWidth: isMobile ? "100vw" : "1200px",
        }}
        bodyStyle={{
          padding: isMobile ? "12px" : "24px",
          textAlign: "center",
        }}
      >
        <img
          alt="preview"
          style={{
            width: "100%",
            maxHeight: isMobile ? "70vh" : "80vh",
            objectFit: "contain",
          }}
          src={previewImage}
        />
      </Modal>
    </div>
  );
};

export default ImageGallery;
