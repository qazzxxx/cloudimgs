import React, { useState, useEffect, useRef } from "react";
import {
  Masonry,
  Button,
  Space,
  Typography,
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
  const [previewFile, setPreviewFile] = useState(null);
  const [dir, setDir] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoverKey, setHoverKey] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef(null);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    // 从localStorage读取分页大小，默认为10
    const savedPageSize = localStorage.getItem("imageGalleryPageSize");
    return savedPageSize ? parseInt(savedPageSize) : 10;
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  const fetchImages = async (
    targetDir = dir,
    targetPage = currentPage,
    targetPageSize = pageSize,
    targetSearch = searchText,
    append = false
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        page: targetPage,
        pageSize: targetPageSize,
        ...(targetSearch && { search: targetSearch }),
        ...(targetDir && { dir: targetDir }),
      };

      const res = await api.get("/images", { params });
      if (res.data.success) {
        setImages((prev) => (append ? prev.concat(res.data.data) : res.data.data));
        setPagination(res.data.pagination);
        const p = res.data.pagination;
        setHasMore(p.current < p.totalPages);
      }
    } catch (e) {
      message.error("获取图片列表失败");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  // 使用ref来跟踪是否是首次加载和防抖
  const isInitialized = useRef(false);
  const searchTimerRef = useRef(null);

  // 统一的数据获取逻辑
  useEffect(() => {
    if (!isInitialized.current) {
      fetchImages("", 1, pageSize, "");
      isInitialized.current = true;
      return;
    }
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      setHasMore(true);
      fetchImages(dir, 1, pageSize, searchText, false);
    }, searchText ? 500 : 0);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [dir, pageSize, searchText]);

  // 当搜索文本变化时重置到第一页
  useEffect(() => {
    if (isInitialized.current) {
      setCurrentPage(1);
    }
  }, [searchText]);

  useEffect(() => {
    if (!isInitialized.current) return;
    if (currentPage > 1) {
      fetchImages(dir, currentPage, pageSize, searchText, true);
    }
  }, [currentPage]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          hasMore &&
          !loading &&
          !loadingMore &&
          images.length > 0
        ) {
          setCurrentPage((p) => p + 1);
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, images.length]);

  const handleDelete = async (relPath) => {
    try {
      await api.delete(`/images/${encodeURIComponent(relPath)}`);
      message.success("删除成功");
      fetchImages(dir, currentPage, pageSize, searchText);
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
    setPreviewFile(file);
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
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => message.success("链接已复制到剪贴板"))
        .catch(() => message.error("复制失败"));
      return;
    }
    const input = document.createElement("input");
    input.style.position = "fixed";
    input.style.top = "-10000px";
    input.style.zIndex = "-999";
    document.body.appendChild(input);
    input.value = text;
    input.focus();
    input.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      if (!ok) {
        message.error("复制失败");
      } else {
        message.success("链接已复制到剪贴板");
      }
    } catch (e) {
      document.body.removeChild(input);
      message.error("当前浏览器不支持复制功能");
    }
  };

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
            onClick={() => fetchImages(dir, currentPage, pageSize, searchText)}
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
            共 {pagination.total} 张图片
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
      ) : images.length === 0 ? (
        <Empty
          description="暂无图片"
          style={{ marginTop: isMobile ? 30 : 50 }}
        />
      ) : (
        <>
          <Masonry
            columns={
              isMobile ? 1 : screens.lg ? 4 : screens.md ? 3 : screens.sm ? 2 : 1
            }
            gutter={isMobile ? 8 : 16}
            items={images.map((image, index) => ({
              key: image.relPath || `item-${index}`,
              data: image,
            }))}
            itemRender={({ data: image }) => (
              <div
                style={{ position: "relative" }}
                onMouseEnter={() =>
                  setHoverKey(image.relPath || image.url || image.filename)
                }
                onMouseLeave={() => setHoverKey(null)}
              >
                <img
                  alt={image.filename}
                  src={image.url}
                  style={{
                    width: "100%",
                    objectFit: "cover",
                    cursor: "pointer",
                    display: "block",
                  }}
                  onClick={() => handlePreview(image)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    background: "rgba(0,0,0,0.6)",
                    borderRadius: 4,
                    padding: "2px 6px",
                  }}
                >
                  <Text style={{ color: "white", fontSize: 12 }}>
                    {formatFileSize(image.size)}
                  </Text>
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    display:
                      hoverKey === (image.relPath || image.url || image.filename)
                        ? "flex"
                        : "none",
                    gap: 6,
                  }}
                >
                  <Button
                    type="primary"
                    size="small"
                    ghost
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(image)}
                    title="预览"
                  />
                  <Button
                    type="primary"
                    size="small"
                    ghost
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(image)}
                    title="下载"
                  />
                  <Button
                    type="primary"
                    size="small"
                    ghost
                    icon={<CopyOutlined />}
                    onClick={() =>
                      copyToClipboard(`${window.location.origin}${image.url}`)
                    }
                    title="复制链接"
                  />
                  <Popconfirm
                    title="确定要删除这张图片吗？"
                    onConfirm={() => handleDelete(image.relPath)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      size="small"
                      danger
                      type="primary"
                      ghost
                      icon={<DeleteOutlined />}
                      title="删除"
                    />
                  </Popconfirm>
                </div>
              </div>
            )}
          />

          <div ref={loadMoreRef} style={{ height: 1 }} />
          {loadingMore && (
            <div style={{ textAlign: "center", padding: isMobile ? 12 : 16 }}>
              <Spin />
            </div>
          )}
        </>
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
        styles={{
          body: {
            padding: isMobile ? "12px" : "24px",
          },
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "flex-start",
            gap: isMobile ? 12 : 24,
          }}
        >
          <div style={{ flex: 3 }}>
            <img
              alt="preview"
              style={{
                width: "100%",
                maxHeight: isMobile ? "60vh" : "75vh",
                objectFit: "contain",
                display: "block",
              }}
              src={previewImage}
            />
          </div>
          {previewFile && (
            <div style={{ flex: 2, textAlign: "left" }}>
              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>
                  {previewFile.filename}
                </Title>
                {previewFile.relPath && previewFile.relPath.includes("/") && (
                  <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
                    所属目录：
                    <span
                      style={{
                        background: colorBgContainer,
                        border: `1px solid ${colorBorder}`,
                        borderRadius: 4,
                        padding: "2px 6px",
                        marginLeft: 6,
                      }}
                    >
                      {previewFile.relPath.substring(
                        0,
                        previewFile.relPath.lastIndexOf("/")
                      )}
                    </span>
                  </Text>
                )}
                <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                  大小：{formatFileSize(previewFile.size)}
                </Text>
                <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                  类型：{previewFile.mimetype || "-"}
                </Text>
                <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                  上传时间：
                  {dayjs(previewFile.uploadTime).format("YYYY-MM-DD HH:mm:ss")}
                </Text>
                <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                  链接：
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ wordBreak: "break-all", marginLeft: 6 }}
                  >
                    {`${window.location.origin}${previewFile.url}`}
                  </a>
                </Text>
                <Space size="small" wrap style={{ marginTop: 8 }}>
                  <Button
                    size={isMobile ? "small" : "middle"}
                    icon={<CopyOutlined />}
                    onClick={() =>
                      copyToClipboard(`${window.location.origin}${previewFile.url}`)
                    }
                  >
                    复制链接
                  </Button>
                  <Button
                    size={isMobile ? "small" : "middle"}
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(previewFile)}
                  >
                    下载
                  </Button>
                  <Popconfirm
                    title="确定要删除这张图片吗？"
                    onConfirm={() => handleDelete(previewFile.relPath)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      danger
                      size={isMobile ? "small" : "middle"}
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ImageGallery;
