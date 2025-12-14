import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Tooltip,
  Empty,
  Spin,
  Grid,
  theme,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  CopyOutlined,
  EditOutlined,
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
    token: { colorBgContainer, colorBorder, colorPrimary },
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
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [imageMeta, setImageMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [isEditingDir, setIsEditingDir] = useState(false);
  const [dirValue, setDirValue] = useState("");

  const groups = useMemo(() => {
    const map = new Map();
    for (const img of images) {
      const key = dayjs(img.uploadTime).format("YYYY年MM月DD日");
      const arr = map.get(key) || [];
      arr.push(img);
      map.set(key, arr);
    }
    const dates = Array.from(map.keys()).sort(
      (a, b) => dayjs(b).valueOf() - dayjs(a).valueOf()
    );
    return dates.map((d) => ({ date: d, items: map.get(d) }));
  }, [images]);

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
      setImages((prev) => prev.filter((img) => img.relPath !== relPath));
      const ps = pagination.pageSize || pageSize;
      const newTotal = Math.max(0, (pagination.total || images.length) - 1);
      const newTotalPages = Math.max(1, Math.ceil(newTotal / ps));
      const newCurrent = Math.min(pagination.current || 1, newTotalPages);
      setPagination({
        ...pagination,
        total: newTotal,
        totalPages: newTotalPages,
        current: newCurrent,
      });
      setHasMore(newCurrent < newTotalPages);
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
    const ext = file.filename.includes(".")
      ? file.filename.substring(file.filename.lastIndexOf("."))
      : "";
    const base = ext ? file.filename.slice(0, -ext.length) : file.filename;
    setRenameValue(base);
    setIsEditingName(false);
    setImageMeta(null);
    setMetaLoading(true);
    const currentDir =
      file.relPath && file.relPath.includes("/")
        ? file.relPath.substring(0, file.relPath.lastIndexOf("/"))
        : "";
    setDirValue(currentDir);
    setIsEditingDir(false);
    api
      .get(`/images/meta/${encodeURIComponent(file.relPath)}`)
      .then((res) => {
        if (res.data && res.data.success) {
          setImageMeta(res.data.data);
        }
      })
      .catch(() => {
        // 忽略错误，不阻塞预览
      })
      .finally(() => setMetaLoading(false));
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
          {groups.map((group) => (
            <div key={group.date} style={{ marginBottom: isMobile ? 12 : 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: isMobile ? 8 : 12,
                }}
              >
                <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
                  {group.date}
                </Title>
              </div>
              <Masonry
                columns={
                  isMobile ? 1 : screens.lg ? 4 : screens.md ? 3 : screens.sm ? 2 : 1
                }
                gutter={isMobile ? 6 : 12}
                items={group.items.map((image, index) => ({
                  key: image.relPath || `item-${group.date}-${index}`,
                  data: image,
                }))}
                itemRender={({ data: image }) => (
                  <div
                    style={{
                      position: "relative",
                      overflow: "hidden",
                    }}
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
                        transition: "transform 200ms ease",
                        transform:
                          hoverKey ===
                          (image.relPath || image.url || image.filename)
                            ? "scale(1.1)"
                            : "scale(1)",
                      }}
                      onClick={() => handlePreview(image)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display:
                          hoverKey === (image.relPath || image.url || image.filename)
                            ? "flex"
                            : "none",
                        gap: 4,
                        background: "rgba(0,0,0,0.35)",
                        borderRadius: 16,
                        padding: 4,
                      }}
                    >
                      <Tooltip title="下载">
                        <Button
                          type="text"
                          shape="circle"
                          size="small"
                          icon={
                            <DownloadOutlined style={{ color: "rgba(255,255,255,0.9)" }} />
                          }
                          onClick={() => handleDownload(image)}
                        />
                      </Tooltip>
                      <Tooltip title="复制链接">
                        <Button
                          type="text"
                          shape="circle"
                          size="small"
                          icon={<CopyOutlined style={{ color: "rgba(255,255,255,0.9)" }} />}
                          onClick={() =>
                            copyToClipboard(`${window.location.origin}${image.url}`)
                          }
                        />
                      </Tooltip>
                      <Popconfirm
                        title="确定要删除这张图片吗？"
                        onConfirm={() => handleDelete(image.relPath)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            shape="circle"
                            size="small"
                            icon={<DeleteOutlined style={{ color: "rgba(255,77,79,0.9)" }} />}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                )}
              />
            </div>
          ))}
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
        title={null}
        footer={null}
        onCancel={() => {
          setPreviewVisible(false);
          setIsEditingName(false);
        }}
        width={isMobile ? "95%" : "80%"}
        style={{
          top: isMobile ? 10 : 20,
          maxWidth: isMobile ? "100vw" : "1200px",
        }}
        styles={{
          body: {
            padding: 0,
            maxHeight: isMobile ? "90vh" : "80vh",
            overflow: "hidden",
          },
          container: {
            padding: 0,
          }
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "stretch",
            gap: isMobile ? 8 : 16,
            height: "80vh",
          }}
        >
          <div
            style={{
              flex: 3,
              height: isMobile ? "50vh" : "100%",
              overflow: "hidden",
              position: "relative",
              backgroundColor: "#000",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundImage: `url(${previewImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(18px)",
                transform: "scale(1.08)",
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                background: "rgba(0,0,0,0.35)",
                zIndex: 1,
              }}
            />
            <img
              alt="preview"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
                margin: 0,
                padding: 0,
                position: "relative",
                zIndex: 2,
              }}
              src={previewImage}
            />
          </div>
          {previewFile && (
            <div
              style={{
                flex: 2,
                textAlign: "left",
                height: isMobile ? "auto" : "100%",
                maxHeight: isMobile ? "40vh" : "100%",
                overflowY: "auto",
                padding: isMobile ? 8 : '26px 16px',
              }}
            >
              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                <Title
                  level={isMobile ? 4 : 3}
                  style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span>{previewFile.filename}</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined style={{ color: colorPrimary }} />}
                    onClick={() => setIsEditingName((v) => !v)}
                  />
                </Title>
                {isEditingName && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      size={isMobile ? "small" : "middle"}
                      placeholder="输入新文件名（不含扩展名）"
                      style={{ maxWidth: 280 }}
                    />
                    <Button
                      type="primary"
                      loading={renaming}
                      size={isMobile ? "small" : "middle"}
                      onClick={async () => {
                        const oldRel = previewFile.relPath;
                        const ext =
                          previewFile.filename.includes(".")
                            ? previewFile.filename.substring(
                                previewFile.filename.lastIndexOf(".")
                              )
                            : "";
                        const newNameRaw = renameValue.trim();
                        if (!newNameRaw) {
                          message.warning("请输入新文件名");
                          return;
                        }
                        const hasExt = /\.[A-Za-z0-9]+$/.test(newNameRaw);
                        const newName = hasExt ? newNameRaw : `${newNameRaw}${ext}`;
                        try {
                          setRenaming(true);
                          const res = await api.put(
                            `/images/${encodeURIComponent(oldRel)}`,
                            { newName }
                          );
                          if (res.data && res.data.success) {
                            const updated = res.data.data;
                            setPreviewFile(updated);
                            setPreviewTitle(updated.filename);
                            setPreviewImage(updated.url);
                            setImages((prev) =>
                              prev.map((img) =>
                                img.relPath === oldRel ? { ...img, ...updated } : img
                              )
                            );
                            setIsEditingName(false);
                            message.success("重命名成功");
                          } else {
                            message.error(res.data?.error || "重命名失败");
                          }
                        } catch (e) {
                          message.error("重命名失败");
                        } finally {
                          setRenaming(false);
                        }
                      }}
                    >
                      保存
                    </Button>
                    <Button
                      size={isMobile ? "small" : "middle"}
                      onClick={() => setIsEditingName(false)}
                    >
                      取消
                    </Button>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
                    所属目录：
                  </Text>
                  {!isEditingDir ? (
                    <>
                      <span
                        style={{
                          background: colorBgContainer,
                          border: `1px solid ${colorBorder}`,
                          borderRadius: 4,
                          padding: "0px 6px",
                          lineHeight: 1.3
                        }}
                      >
                        {dirValue || "根目录"}
                      </span>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => setIsEditingDir(true)}
                      >
                        修改
                      </Button>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "72%" }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <DirectorySelector
                          value={dirValue}
                          onChange={setDirValue}
                          size="small"
                          api={api}
                          placeholder="选择或输入新目录"
                        />
                      </div>
                      <Button
                        type="primary"
                        size="small"
                        onClick={async () => {
                          const oldRel = previewFile.relPath;
                          try {
                            const res = await api.put(
                              `/images/${encodeURIComponent(oldRel)}`,
                              { newDir: dirValue || "" }
                            );
                            if (res.data && res.data.success) {
                              const updated = res.data.data;
                              setPreviewFile(updated);
                              setPreviewTitle(updated.filename);
                              setPreviewImage(updated.url);
                              setImages((prev) =>
                                prev.map((img) =>
                                  img.relPath === oldRel ? { ...img, ...updated } : img
                                )
                              );
                              setIsEditingDir(false);
                              message.success("目录已更新");
                            } else {
                              message.error(res.data?.error || "更新目录失败");
                            }
                          } catch (e) {
                            message.error("更新目录失败");
                          }
                        }}
                      >
                        保存
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setIsEditingDir(false);
                          setDirValue(
                            previewFile.relPath && previewFile.relPath.includes("/")
                              ? previewFile.relPath.substring(
                                  0,
                                  previewFile.relPath.lastIndexOf("/")
                                )
                              : ""
                          );
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  )}
                </div>
                <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                  图片大小：{formatFileSize(previewFile.size)}
                </Text>
                {metaLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Spin size="small" />
                    <Text style={{ fontSize: isMobile ? 12 : 13 }} type="secondary">
                      正在读取图片信息…
                    </Text>
                  </div>
                ) : (
                  imageMeta && (
                    <>
                      <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                        图片尺寸：{imageMeta.width} × {imageMeta.height}
                      </Text>
                      <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                        图片格式：{imageMeta.format || "-"}
                      </Text>
                      {imageMeta.space && (
                        <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                          颜色空间：{imageMeta.space}
                        </Text>
                      )}
                      {imageMeta.dominant && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontSize: isMobile ? 12 : 13 }}>图片主色：</Text>
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              border: `1px solid ${colorBorder}`,
                              background: `rgb(${imageMeta.dominant.r},${imageMeta.dominant.g},${imageMeta.dominant.b})`,
                            }}
                          />
                          <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
                            rgb({imageMeta.dominant.r},{imageMeta.dominant.g},{imageMeta.dominant.b})
                          </Text>
                        </div>
                      )}
                      {imageMeta.orientation && (
                        <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                          图片方向：{imageMeta.orientation}
                        </Text>
                      )}
                      {imageMeta.exif && (
                        <>
                          {(imageMeta.exif.make || imageMeta.exif.model) && (
                            <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                              拍摄设备：{[imageMeta.exif.make, imageMeta.exif.model].filter(Boolean).join(" ")}
                            </Text>
                          )}
                          {imageMeta.exif.lensModel && (
                            <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                              图片镜头：{imageMeta.exif.lensModel}
                            </Text>
                          )}
                          {(imageMeta.exif.fNumber || imageMeta.exif.exposureTime || imageMeta.exif.iso) && (
                            <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                              图片曝光：{[
                                imageMeta.exif.fNumber ? `f/${imageMeta.exif.fNumber}` : null,
                                imageMeta.exif.exposureTime ? `${imageMeta.exif.exposureTime}s` : null,
                                imageMeta.exif.iso ? `ISO ${imageMeta.exif.iso}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          )}
                          {imageMeta.exif.dateTimeOriginal && (
                            <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                              拍摄时间：{dayjs(imageMeta.exif.dateTimeOriginal).format("YYYY-MM-DD HH:mm:ss")}
                            </Text>
                          )}
                          {(imageMeta.exif.latitude != null && imageMeta.exif.longitude != null) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                                拍摄位置：{imageMeta.exif.latitude.toFixed(6)}, {imageMeta.exif.longitude.toFixed(6)}
                              </Text>
                              <a
                                href={`https://www.google.com/maps?q=${imageMeta.exif.latitude},${imageMeta.exif.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: isMobile ? 12 : 13 }}
                              >
                                地图
                              </a>
                            </div>
                          )}
                        </>
                      )}
                      {imageMeta.createTime && (
                        <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                          创建时间：{dayjs(imageMeta.createTime).format("YYYY-MM-DD HH:mm:ss")}
                        </Text>
                      )}
                    </>
                  )
                )}
                <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                  上传时间：
                  {dayjs(previewFile.uploadTime).format("YYYY-MM-DD HH:mm:ss")}
                </Text>
                <Text style={{ fontSize: isMobile ? 12 : 13 }}>
                  图片链接：
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
