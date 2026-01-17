import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Tooltip,
  Input,
  Space,
  Typography,
  message,
  Popconfirm,
  theme,
  Grid,
} from "antd";
import {
  LeftOutlined,
  RightOutlined,
  CopyOutlined,
  EditOutlined,
  FolderOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { thumbHashToDataURL } from "thumbhash";
import DirectorySelector from "./DirectorySelector";

const { Title, Text } = Typography;

// Helper to convert base64 thumbhash to data URL
const getThumbHashUrl = (hash) => {
  if (!hash) return null;
  try {
    const binary = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0));
    return thumbHashToDataURL(binary);
  } catch (e) {
    console.error("ThumbHash decode error:", e);
    return null;
  }
};

const encodePath = (path) => {
  if (!path) return "";
  return path.split('/').map(encodeURIComponent).join('/');
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Helper: Format aperture
const formatFNumber = (val) => {
  if (!val) return "";
  const num = parseFloat(val);
  return parseFloat(num.toFixed(1));
};

// Helper: Format exposure time
const formatExposureTime = (val) => {
  if (!val) return "";
  const num = parseFloat(val);
  if (num >= 1) return parseFloat(num.toFixed(1)) + "s";
  return `1/${Math.round(1 / num)}s`;
};

const ImageDetailModal = ({
  visible,
  onCancel,
  file,
  api,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onDelete,
  onUpdate, // Callback when file is renamed or moved
}) => {
  const {
    token: { colorBgContainer, colorText, colorTextSecondary, colorPrimary },
  } = theme.useToken();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isDarkMode =
    colorBgContainer === "#141414" ||
    colorBgContainer === "#000000" ||
    colorBgContainer === "#1f1f1f";

  const [imageMeta, setImageMeta] = useState(null);
  const [previewLocation, setPreviewLocation] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isEditingDir, setIsEditingDir] = useState(false);
  const [dirValue, setDirValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset state when file changes
  useEffect(() => {
    if (file) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      // ... existing reset logic
      setImageMeta(null);
      setPreviewLocation("");
      setIsEditingName(false);
      setIsEditingDir(false);

      const ext = file.filename.includes(".")
        ? file.filename.substring(file.filename.lastIndexOf("."))
        : "";
      const base = ext ? file.filename.slice(0, -ext.length) : file.filename;
      setRenameValue(base);

      const currentDir =
        file.relPath && file.relPath.includes("/")
          ? file.relPath.substring(0, file.relPath.lastIndexOf("/"))
          : "";
      setDirValue(currentDir);

      // Fetch Meta
      let active = true;
      api
        .get(`/images/meta/${encodePath(file.relPath)}`)
        .then((res) => {
          if (active && res.data && res.data.success) {
            setImageMeta(res.data.data);
          }
        })
        .catch(() => { });

      return () => {
        active = false;
      };
    }
  }, [file, api]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWheel = (e) => {
    e.stopPropagation();
    // 阻止默认滚动行为，避免页面滚动
    // e.preventDefault(); // React synthetic event might not support this in all cases, better handle in container

    const scaleAmount = -e.deltaY * 0.001;
    setZoom((prevZoom) => {
      const newZoom = prevZoom + scaleAmount;
      return Math.max(1, Math.min(newZoom, 5)); // Limit zoom between 1x and 5x
    });
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault(); // Prevent default drag behavior
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset position if zoomed out to 1
  useEffect(() => {
    if (zoom === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Fetch Location
  useEffect(() => {
    if (!visible || !imageMeta?.exif?.latitude) {
      setPreviewLocation("");
      return;
    }

    const { latitude, longitude } = imageMeta.exif;
    let active = true;

    const fetchPreviewLoc = async () => {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=zh-CN`
        );
        const geoData = await geoRes.json();

        if (active && geoData) {
          const addr = geoData.address;
          const parts = [];
          if (addr.province) parts.push(addr.province);
          if (addr.city && addr.city !== addr.province) parts.push(addr.city);
          if (addr.district || addr.county)
            parts.push(addr.district || addr.county);
          if (addr.road || addr.street || addr.pedestrian)
            parts.push(addr.road || addr.street || addr.pedestrian);
          if (addr.house_number) parts.push(addr.house_number);

          const name = geoData.display_name.split(",")[0];
          if (name && !parts.includes(name)) {
            parts.push(name);
          }

          let fullAddr = parts.join(" ");
          if (!fullAddr) {
            fullAddr = geoData.display_name;
          }

          setPreviewLocation(fullAddr);
        }
      } catch (e) { }
    };

    fetchPreviewLoc();
    return () => {
      active = false;
    };
  }, [visible, imageMeta]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!visible) return;
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, hasNext, hasPrev, onNext, onPrev]);

  const handleDownload = () => {
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
      document.execCommand("copy");
      message.success("链接已复制到剪贴板");
    } catch (e) {
      message.error("复制失败");
    } finally {
      document.body.removeChild(input);
    }
  };

  const handleRename = async () => {
    const oldRel = file.relPath;
    const ext = file.filename.includes(".")
      ? file.filename.substring(file.filename.lastIndexOf("."))
      : "";
    const newNameRaw = renameValue.trim();
    if (!newNameRaw) return;
    const hasExt = /\.[A-Za-z0-9]+$/.test(newNameRaw);
    const newName = hasExt ? newNameRaw : `${newNameRaw}${ext}`;
    try {
      setRenaming(true);
      const res = await api.put(`/images/${encodePath(oldRel)}`, {
        newName,
      });
      if (res.data?.success) {
        const updated = res.data.data;
        message.success("重命名成功");
        setIsEditingName(false);
        if (onUpdate) onUpdate(updated);
      }
    } catch (e) {
      message.error("重命名失败");
    } finally {
      setRenaming(false);
    }
  };

  const handleMove = async () => {
    const oldRel = file.relPath;
    try {
      const res = await api.put(`/images/${encodePath(oldRel)}`, {
        newDir: dirValue || "",
      });
      if (res.data?.success) {
        const updated = res.data.data;
        message.success("目录已更新");
        setIsEditingDir(false);
        if (onUpdate) onUpdate(updated);
      }
    } catch (e) {
      message.error("移动失败");
    }
  };

  const thumbUrl = React.useMemo(() => {
    if (!file || !file.thumbhash) return null;
    return getThumbHashUrl(file.thumbhash);
  }, [file]);
  const hasThumb = !!thumbUrl;
  const isDarkBg = hasThumb || isDarkMode;
  const isLight = !isDarkBg;

  const textColor = hasThumb ? "#fff" : colorText;
  const secondaryTextColor = hasThumb
    ? "rgba(255,255,255,0.75)"
    : colorTextSecondary;
  const tertiaryTextColor = hasThumb
    ? "rgba(255,255,255,0.5)"
    : isDarkMode
      ? "rgba(255,255,255,0.45)"
      : "rgba(0,0,0,0.45)";
  const inputBg = hasThumb
    ? "rgba(255,255,255,0.15)"
    : isDarkMode
      ? "rgba(255,255,255,0.1)"
      : "rgba(0,0,0,0.06)";

  if (!file) return null;

  return (
    <Modal
      open={visible}
      title={null}
      footer={null}
      onCancel={onCancel}
      width="100vw"
      style={{
        top: 0,
        margin: 0,
        maxWidth: "100vw",
        padding: 0,
      }}
      styles={{
        body: {
          padding: 0,
          height: "100vh",
          overflow: "hidden",
          background: "#000",
        },
        content: {
          padding: 0,
          background: "#000",
          boxShadow: "none",
        },
        container: { padding: 0 }
      }}
      closeIcon={null}
    >
      <div
        style={{
          display: "flex",
          height: "100vh",
          position: "relative",
        }}
      >
        {/* Close & Action Buttons */}
        <div
          style={{
            position: "absolute",
            top: 20,
            right: isMobile ? 20 : 420,
            zIndex: 1000,
            display: "flex",
            gap: 12,
          }}
        >
          <Tooltip title="复制链接">
            <Button
              shape="circle"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(window.location.origin + file.url)}
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                width: 40,
                height: 40,
              }}
            />
          </Tooltip>
          <Button
            shape="circle"
            icon={<span style={{ fontSize: 24, lineHeight: 1 }}>×</span>}
            onClick={onCancel}
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              width: 40,
              height: 40,
            }}
          />
        </div>

        {/* Left: Image Viewer */}
        <div
          style={{
            flex: 1,
            height: "100%",
            overflow: "hidden",
            position: "relative",
            backgroundColor: "#0f0f0f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Nav Buttons */}
          {!isMobile && hasPrev && (
            <Button
              type="text"
              icon={
                <LeftOutlined
                  style={{ fontSize: 24, color: "rgba(255,255,255,0.8)" }}
                />
              }
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              style={{
                position: "absolute",
                left: 20,
                zIndex: 100,
                height: "100%",
                width: 80,
                background:
                  "linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 100%)",
                border: "none",
                opacity: 0,
                transition: "opacity 0.3s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
            />
          )}
          {!isMobile && hasNext && (
            <Button
              type="text"
              icon={
                <RightOutlined
                  style={{ fontSize: 24, color: "rgba(255,255,255,0.8)" }}
                />
              }
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              style={{
                position: "absolute",
                right: 20,
                zIndex: 100,
                height: "100%",
                width: 80,
                background:
                  "linear-gradient(-90deg, rgba(0,0,0,0.3) 0%, transparent 100%)",
                border: "none",
                opacity: 0,
                transition: "opacity 0.3s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
            />
          )}

          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden", // Ensure zoomed image doesn't overflow container
              cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Blurry Background */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundImage: `url(${thumbUrl || file.url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(40px) brightness(0.5)",
                transform: "scale(1.2)",
                zIndex: 0,
              }}
            />
            <img
              alt="preview"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                zIndex: 2,
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transition: isDragging ? "none" : "transform 0.1s ease-out", // Smooth zoom, instant drag
                pointerEvents: "none", // Let container handle events
              }}
              src={file.url}
              draggable={false}
            />
          </div>
        </div>

        {/* Right: Info Sidebar */}
        <div
          style={{
            width: isMobile ? "100%" : 360,
            background: hasThumb
              ? `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${thumbUrl}) center/cover no-repeat`
              : colorBgContainer,
            color: textColor,
            borderLeft: isDarkMode
              ? "1px solid rgba(255,255,255,0.1)"
              : "none",
            display: isMobile ? "none" : "flex",
            flexDirection: "column",
            zIndex: 20,
            transition: "background 0.3s ease, color 0.3s ease",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
            {/* Header Section */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Title
                  level={4}
                  style={{
                    margin: 0,
                    wordBreak: "break-all",
                    color: textColor,
                    fontSize: 18,
                  }}
                >
                  {file.filename}
                </Title>
                <Button
                  type="text"
                  icon={
                    <EditOutlined style={{ color: secondaryTextColor }} />
                  }
                  onClick={() => setIsEditingName(!isEditingName)}
                />
              </div>

              {isEditingName && (
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onPressEnter={handleRename}
                    style={{
                      background: inputBg,
                      color: textColor,
                      border: "none",
                    }}
                  />
                  <Button
                    type="primary"
                    ghost={!isLight}
                    loading={renaming}
                    onClick={handleRename}
                  >
                    保存
                  </Button>
                </div>
              )}

              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <FolderOutlined style={{ color: secondaryTextColor }} />
                <Text style={{ fontSize: 13, color: secondaryTextColor }}>
                  {dirValue || "根目录"}
                </Text>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setIsEditingDir(!isEditingDir)}
                  style={{
                    padding: 0,
                    height: "auto",
                    color: isLight ? colorPrimary : "rgba(255,255,255,0.8)",
                  }}
                >
                  修改
                </Button>
              </div>
              {isEditingDir && (
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <DirectorySelector
                      value={dirValue}
                      onChange={setDirValue}
                      size="small"
                      api={api}
                      style={{
                        background: inputBg,
                        color: textColor,
                        border: "none",
                      }}
                    />
                  </div>
                  <Button
                    type="primary"
                    ghost={!isLight}
                    size="small"
                    onClick={handleMove}
                  >
                    保存
                  </Button>
                </div>
              )}
            </div>

            {/* Actions Row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
              <Button
                block
                ghost
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                variant="outlined"
                color="primary"
              >
                下载
              </Button>
              <Popconfirm
                title="确定删除?"
                onConfirm={() => onDelete && onDelete(file.relPath)}
                okText="是"
                cancelText="否"
              >
                <Button block ghost danger icon={<DeleteOutlined />} variant="outlined" color="danger">
                  删除
                </Button>
              </Popconfirm>
            </div>

            {/* Info Sections */}
            <Space direction="vertical" size={24} style={{ width: "100%" }}>
              {/* Basic Info */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: tertiaryTextColor,
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  基本信息
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: tertiaryTextColor,
                        fontSize: 12,
                        marginBottom: 2,
                      }}
                    >
                      文件大小
                    </div>
                    <div style={{ fontSize: 13, color: textColor }}>
                      {formatFileSize(file.size || 0)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        color: tertiaryTextColor,
                        fontSize: 12,
                        marginBottom: 2,
                      }}
                    >
                      格式
                    </div>
                    <div style={{ fontSize: 13, color: textColor }}>
                      {file.filename.split(".").pop().toUpperCase()}
                    </div>
                  </div>
                  {imageMeta && (
                    <>
                      <div>
                        <div
                          style={{
                            color: tertiaryTextColor,
                            fontSize: 12,
                            marginBottom: 2,
                          }}
                        >
                          分辨率
                        </div>
                        <div style={{ fontSize: 13, color: textColor }}>
                          {imageMeta.width} × {imageMeta.height}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            color: tertiaryTextColor,
                            fontSize: 12,
                            marginBottom: 2,
                          }}
                        >
                          色彩空间
                        </div>
                        <div style={{ fontSize: 13, color: textColor }}>
                          {imageMeta.space || "-"}
                        </div>
                      </div>
                    </>
                  )}
                  <div>
                    <div
                      style={{
                        color: tertiaryTextColor,
                        fontSize: 12,
                        marginBottom: 2,
                      }}
                    >
                      上传时间
                    </div>
                    <div style={{ fontSize: 13, color: textColor }}>
                      {dayjs(file.uploadTime).format("YYYY-MM-DD")}
                    </div>
                  </div>
                  {previewLocation && (
                    <div style={{ gridColumn: "span 2" }}>
                      <div
                        style={{
                          color: tertiaryTextColor,
                          fontSize: 12,
                          marginBottom: 2,
                        }}
                      >
                        拍摄地点
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: textColor,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <EnvironmentOutlined /> {previewLocation}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* EXIF Data */}
              {imageMeta?.exif && (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: tertiaryTextColor,
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    拍摄参数
                  </div>
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <CameraOutlined
                        style={{ fontSize: 16, color: tertiaryTextColor }}
                      />
                      <div>
                        <div style={{ fontSize: 13, color: textColor }}>
                          {[imageMeta.exif.make, imageMeta.exif.model]
                            .filter(Boolean)
                            .join(" ")}
                        </div>
                        <div style={{ fontSize: 12, color: tertiaryTextColor }}>
                          相机
                        </div>
                      </div>
                    </div>
                    {imageMeta.exif.dateTimeOriginal && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <HistoryOutlined
                          style={{ fontSize: 16, color: tertiaryTextColor }}
                        />
                        <div>
                          <div style={{ fontSize: 13, color: textColor }}>
                            {dayjs(imageMeta.exif.dateTimeOriginal).format(
                              "YYYY-MM-DD HH:mm:ss"
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: tertiaryTextColor }}>
                            拍摄时间
                          </div>
                        </div>
                      </div>
                    )}
                    {imageMeta.exif.lensModel && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{ fontSize: 16, color: tertiaryTextColor }}
                        >
                          ◎
                        </span>
                        <div>
                          <div style={{ fontSize: 13, color: textColor }}>
                            {imageMeta.exif.lensModel}
                          </div>
                          <div
                            style={{ fontSize: 12, color: tertiaryTextColor }}
                          >
                            镜头
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 24, marginTop: 4, flexWrap: "wrap" }}>
                      {imageMeta.exif.fNumber && (
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: textColor,
                            }}
                          >
                            f/{formatFNumber(imageMeta.exif.fNumber)}
                          </div>
                          <div
                            style={{ fontSize: 12, color: tertiaryTextColor }}
                          >
                            光圈
                          </div>
                        </div>
                      )}
                      {imageMeta.exif.exposureTime && (
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: textColor,
                            }}
                          >
                            {formatExposureTime(imageMeta.exif.exposureTime)}
                          </div>
                          <div
                            style={{ fontSize: 12, color: tertiaryTextColor }}
                          >
                            快门
                          </div>
                        </div>
                      )}
                      {imageMeta.exif.iso && (
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: textColor,
                            }}
                          >
                            {imageMeta.exif.iso}
                          </div>
                          <div
                            style={{ fontSize: 12, color: tertiaryTextColor }}
                          >
                            ISO
                          </div>
                        </div>
                      )}
                    </div>
                  </Space>
                </div>
              )}
            </Space>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ImageDetailModal;
