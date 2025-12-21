import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Popover,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  CopyOutlined,
  EditOutlined,
  SearchOutlined,
  ReloadOutlined,
  FolderOutlined,
  MenuOutlined,
  ApiOutlined,
  CloudUploadOutlined,
  LeftOutlined,
  RightOutlined,
  InfoCircleOutlined,
  CameraOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  FileImageOutlined,
  ExpandOutlined,
  CompressOutlined,
} from "@ant-design/icons";
import DirectorySelector from "./DirectorySelector";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Search } = Input;

const ImageGallery = ({ onDelete, onRefresh, api, isAuthenticated }) => {
  const {
    token: { colorBgContainer, colorBorder, colorPrimary, colorTextSecondary, colorText },
  } = theme.useToken();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isDark = theme.useToken().theme?.id === 1 || colorBgContainer === "#141414";
  const isDarkMode = colorBgContainer === "#141414" || colorBgContainer === "#000000" || colorBgContainer === "#1f1f1f";

  // Define capsule styles based on theme
  const capsuleStyle = {
    background: isDarkMode ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.65)",
    border: `1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.4)"}`,
    boxShadow: isDarkMode ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(0, 0, 0, 0.08)",
    dividerColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0,0,0,0.1)",
    iconColor: isDarkMode ? "rgba(255, 255, 255, 0.45)" : "rgba(0,0,0,0.4)",
  };

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
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    // Check authentication first
    if (isAuthenticated === false) {
        return;
    }

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
        // Silent fail or minimal logging to avoid spamming user if it's just auth
        if (e.response && e.response.status !== 401) {
             message.error("获取图片列表失败");
        }
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
  }, [dir, pageSize, searchText, isAuthenticated]); // Add isAuthenticated dependency

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

  // Handle file uploads (Drag & Drop + Paste)
  const handleUploadFiles = async (files) => {
    if (!isAuthenticated) {
        message.warning("请先登录");
        return;
    }
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    // Use current directory if set, otherwise root
    if (dir) {
        formData.append("dir", dir);
    }
    
    let imageCount = 0;
    Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
            formData.append("image", file); // API expects "image" field for multiple files too? 
            // Checking UploadComponent logic, usually it's "image" or "files"
            // Let's assume the API handles multiple files under same key or we need to check API docs
            // Based on ApiDocs.js: POST /api/upload uses 'image' field for files
            imageCount++;
        }
    });

    if (imageCount === 0) {
        message.warning("请选择图片文件");
        setUploading(false);
        return;
    }

    try {
        const res = await api.post("/upload", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        
        if (res.data && res.data.success) {
            message.success(`成功上传 ${res.data.data.length || imageCount} 张图片`);
            // Refresh list
            setCurrentPage(1);
            fetchImages(dir, 1, pageSize, searchText, false);
            if (onRefresh) onRefresh();
        } else {
             message.error(res.data?.error || "上传失败");
        }
    } catch (error) {
        console.error("Upload error:", error);
        message.error("上传出错");
    } finally {
        setUploading(false);
        setIsDragging(false);
    }
  };

  // Global Paste Event Listener
  useEffect(() => {
    const handlePaste = (e) => {
        // Ignore paste if inside input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const items = e.clipboardData?.items;
        if (!items) return;

        const files = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length > 0) {
            e.preventDefault();
            handleUploadFiles(files);
        }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [dir, isAuthenticated]); // Re-bind if dir changes so upload goes to correct dir

  // Global Drag & Drop Listeners
  useEffect(() => {
      let dragCounter = 0;

      const handleDragEnter = (e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounter++;
          if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
              setIsDragging(true);
          }
      };

      const handleDragLeave = (e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounter--;
          if (dragCounter === 0) {
              setIsDragging(false);
          }
      };

      const handleDragOver = (e) => {
          e.preventDefault();
          e.stopPropagation();
      };

      const handleDrop = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          dragCounter = 0;
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleUploadFiles(e.dataTransfer.files);
          }
      };

      window.addEventListener('dragenter', handleDragEnter);
      window.addEventListener('dragleave', handleDragLeave);
      window.addEventListener('dragover', handleDragOver);
      window.addEventListener('drop', handleDrop);

      return () => {
          window.removeEventListener('dragenter', handleDragEnter);
          window.removeEventListener('dragleave', handleDragLeave);
          window.removeEventListener('dragover', handleDragOver);
          window.removeEventListener('drop', handleDrop);
      };
  }, [dir, isAuthenticated]);

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
      return true; // Indicate success for callers
    } catch (error) {
      message.error("删除失败");
      return false;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const [previewIndex, setPreviewIndex] = useState(-1);

  // ... (keep existing helper functions)

  const handlePreview = (file) => {
    // Find index in current images list
    const index = images.findIndex(img => img.relPath === file.relPath);
    setPreviewIndex(index);
    setPreviewImage(file.url);
    setPreviewVisible(true);
    setPreviewTitle(file.filename);
    setPreviewFile(file);
    
    // Reset edit states
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
    
    // Fetch meta
    api
      .get(`/images/meta/${encodeURIComponent(file.relPath)}`)
      .then((res) => {
        if (res.data && res.data.success) {
          setImageMeta(res.data.data);
        }
      })
      .catch(() => {})
      .finally(() => setMetaLoading(false));
  };

  const showNext = () => {
      if (previewIndex < images.length - 1) {
          handlePreview(images[previewIndex + 1]);
      }
  };

  const showPrev = () => {
      if (previewIndex > 0) {
          handlePreview(images[previewIndex - 1]);
      }
  };

  // Keyboard navigation
  useEffect(() => {
      const handleKeyDown = (e) => {
          if (!previewVisible) return;
          if (e.key === 'ArrowRight') showNext();
          if (e.key === 'ArrowLeft') showPrev();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewVisible, previewIndex, images]);

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

  // Helper to distribute items into columns
  const getColumns = (items) => {
    const columnsCount = isMobile ? 2 : screens.xl ? 5 : screens.lg ? 4 : screens.md ? 3 : 2;
    const columns = Array.from({ length: columnsCount }, () => []);
    items.forEach((item, index) => {
      columns[index % columnsCount].push(item);
    });
    return columns;
  };

  return (
    <div style={{ padding: isMobile ? "12px" : "24px", minHeight: "100vh" }}>
      {/* Drag & Drop Overlay */}
      {isDragging && (
          <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                background: 'rgba(22, 119, 255, 0.15)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `4px dashed ${colorPrimary}`,
                pointerEvents: 'none', // Allow drops to pass through to window listener
            }}
          >
              <div style={{ 
                  background: colorBgContainer, 
                  padding: '40px 60px', 
                  borderRadius: 24, 
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  textAlign: 'center' 
              }}>
                  <CloudUploadOutlined style={{ fontSize: 64, color: colorPrimary, marginBottom: 16 }} />
                  <Title level={3} style={{ margin: 0 }}>释放以上传图片</Title>
                  <Text type="secondary">支持多图上传</Text>
              </div>
          </div>
      )}
      
      {/* Uploading Spinner Overlay */}
      {uploading && (
          <div
             style={{
                 position: 'fixed',
                 top: 0,
                 left: 0,
                 right: 0,
                 bottom: 0,
                 zIndex: 10000,
                 background: 'rgba(0,0,0,0.5)',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 flexDirection: 'column',
                 gap: 16,
                 color: '#fff'
             }}
          >
              <Spin size="large" />
              <Text style={{ color: '#fff', fontSize: 16 }}>正在上传图片...</Text>
          </div>
      )}

      {/* Floating Capsule Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 32,
          position: "sticky",
          top: 20,
          zIndex: 100,
          pointerEvents: "none", // Allow clicks to pass through the container area
        }}
      >
        <div
          style={{
            pointerEvents: "auto", // Re-enable pointer events for the capsule
            background: capsuleStyle.background,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            padding: "6px",
            borderRadius: "100px",
            boxShadow: capsuleStyle.boxShadow,
            border: capsuleStyle.border,
            display: "flex",
            alignItems: "center",
            gap: 8,
            maxWidth: "90vw",
            width: "auto",
            transition: "all 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingRight: 2,
              paddingLeft: 4,
            }}
          >
             <img 
                src="/favicon.svg" 
                alt="云图" 
                style={{ 
                    width: 24, 
                    height: 24, 
                    objectFit: "contain",
                    filter: isDarkMode ? "brightness(1.2)" : "none" // Slight adjust for dark mode if needed
                }} 
             />
          </div>
          <div style={{ width: 180, transition: "width 0.3s ease" }}>
            <DirectorySelector
              value={dir}
              onChange={setDir}
              placeholder="所有目录"
              style={{ width: "100%" }}
              allowInput={false}
              api={api}
              bordered={false}
              size="middle"
            />
          </div>
          <div
            style={{
              width: 1,
              height: 20,
              background: capsuleStyle.dividerColor,
            }}
          />
          <div style={{ width: 200, transition: "width 0.3s ease" }}>
            <Input
              placeholder="拖拽图片到页面即可上传..."
              prefix={<SearchOutlined style={{ color: capsuleStyle.iconColor }} />}
              bordered={false}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ background: "transparent", color: colorText }}
            />
          </div>
          <div
            style={{
              width: 1,
              height: 20,
              background: capsuleStyle.dividerColor,
            }}
          />
          <Popover
            content={
              <div style={{ width: 160, padding: 4 }}>
                  <Button
                    type="text"
                    icon={<ApiOutlined />}
                    onClick={() => window.open("/api/docs", "_blank")}
                    style={{ 
                        width: "100%", 
                        textAlign: "left", 
                        display: "flex", 
                        alignItems: "center",
                        height: 40,
                        fontSize: 14
                    }}
                  >
                    开放接口
                  </Button>
                  {/* Future menu items can be added here */}
              </div>
            }
            trigger="hover"
            placement="bottomLeft"
            arrow={false}
            overlayInnerStyle={{ padding: 0, borderRadius: 12, overflow: "hidden" }}
          >
            <div
              style={{
                padding: "0 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                height: "100%",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 0.7}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
            >
              <MenuOutlined style={{ color: capsuleStyle.iconColor, fontSize: 18 }} />
            </div>
          </Popover>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Spin size="large" />
        </div>
      ) : images.length === 0 ? (
        <Empty description="暂无图片" style={{ marginTop: 100 }} />
      ) : (
        <>
          {groups.map((group) => (
            <div key={group.date} style={{ marginBottom: 24 }}>
              <div
                style={{
                  marginBottom: 16,
                  paddingLeft: 8,
                  opacity: 0.8,
                  fontWeight: 600,
                  fontSize: "13px",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  color: colorTextSecondary, // Applied theme color
                }}
              >
                {group.date}
              </div>
              
              {/* Masonry Layout */}
              <Masonry
                columns={
                  isMobile ? 2 : screens.xl ? 5 : screens.lg ? 4 : screens.md ? 3 : 2
                }
                gutter={8}
                items={group.items.map((image, index) => ({
                  key: image.relPath || `item-${group.date}-${index}`,
                  data: image,
                }))}
                itemRender={({ data: image }) => (
                  <div
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: "0px", // Sharp corners
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      transition: "transform 0.3s ease",
                      background: colorBgContainer,
                      cursor: "zoom-in",
                    }}
                    onMouseEnter={() =>
                      setHoverKey(image.relPath || image.url || image.filename)
                    }
                    onMouseLeave={() => setHoverKey(null)}
                    onClick={() => handlePreview(image)}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <img
                        alt={image.filename}
                        src={image.url}
                        style={{
                          width: "100%",
                          display: "block",
                          transition: "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                          transform:
                            hoverKey ===
                            (image.relPath || image.url || image.filename)
                              ? "scale(1.05)"
                              : "scale(1)",
                        }}
                      />
                    </div>

                    {/* Advanced Hover Overlay */}
                    {!isMobile && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)",
                          opacity:
                            hoverKey === (image.relPath || image.url || image.filename)
                              ? 1
                              : 0,
                          transition: "opacity 0.3s ease",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "flex-end",
                          padding: "20px",
                          pointerEvents: "none", // Let clicks pass through to container
                        }}
                      >
                        <div
                          style={{
                            transform:
                              hoverKey === (image.relPath || image.url || image.filename)
                                ? "translateY(0)"
                                : "translateY(10px)",
                            transition: "transform 0.3s ease",
                            pointerEvents: "auto", // Re-enable for buttons
                          }}
                        >
                          {/* Title / Filename */}
                          <div
                            style={{
                              color: "#fff",
                              fontSize: "18px",
                              fontWeight: 700,
                              marginBottom: "4px",
                              lineHeight: 1.2,
                              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                              wordBreak: "break-all",
                            }}
                          >
                            {image.filename.replace(/\.[^/.]+$/, "")}
                          </div>

                          {/* Metadata Row */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              color: "rgba(255,255,255,0.8)",
                              fontSize: "12px",
                              marginBottom: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              {dayjs(image.uploadTime).format("YYYY-MM-DD")}
                            </span>
                            <span>·</span>
                            <span>{formatFileSize(image.size)}</span>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: "flex", gap: "8px" }}>
                            <Button
                              size="small"
                              type="text"
                              icon={<DownloadOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(image);
                              }}
                              style={{
                                color: "#fff",
                                background: "rgba(255,255,255,0.2)",
                                backdropFilter: "blur(4px)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "4px",
                                fontSize: "12px",
                              }}
                            >
                              下载
                            </Button>
                            <Button
                              size="small"
                              type="text"
                              icon={<CopyOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(
                                  `${window.location.origin}${image.url}`
                                );
                              }}
                              style={{
                                color: "#fff",
                                background: "rgba(255,255,255,0.2)",
                                backdropFilter: "blur(4px)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "4px",
                                fontSize: "12px",
                              }}
                            >
                              链接
                            </Button>
                            <Popconfirm
                              title="确定删除?"
                              onConfirm={(e) => {
                                e.stopPropagation();
                                handleDelete(image.relPath);
                              }}
                              onCancel={(e) => {
                                  e?.stopPropagation();
                              }}
                              okText="是"
                              cancelText="否"
                            >
                              <Button
                                size="small"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  background: "rgba(0,0,0,0.4)",
                                  backdropFilter: "blur(4px)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                }}
                              />
                            </Popconfirm>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              />
            </div>
          ))}
          <div ref={loadMoreRef} style={{ height: 20 }} />
          {loadingMore && (
            <div style={{ textAlign: "center", padding: 20 }}>
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
          container: {
            padding: 0
          }
        }}
        closeIcon={null} // We will implement our own close button
      >
        <div
          style={{
            display: "flex",
            height: "100vh",
            position: "relative",
          }}
        >
          {/* Close Button */}
          <div style={{ position: "absolute", top: 20, right: isMobile ? 20 : 420, zIndex: 1000, display: "flex", gap: 12 }}>
              <Tooltip title="复制链接">
                  <Button
                    shape="circle"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(window.location.origin + previewFile.url)}
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
                onClick={() => setPreviewVisible(false)}
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
            {!isMobile && previewIndex > 0 && (
                <Button 
                    type="text"
                    icon={<LeftOutlined style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)' }} />}
                    onClick={(e) => { e.stopPropagation(); showPrev(); }}
                    style={{
                        position: 'absolute',
                        left: 20,
                        zIndex: 100,
                        height: '100%',
                        width: 80,
                        background: 'linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
                        border: 'none',
                        opacity: 0,
                        transition: 'opacity 0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                />
            )}
            {!isMobile && previewIndex < images.length - 1 && (
                <Button 
                    type="text"
                    icon={<RightOutlined style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)' }} />}
                    onClick={(e) => { e.stopPropagation(); showNext(); }}
                    style={{
                        position: 'absolute',
                        right: 20,
                        zIndex: 100,
                        height: '100%',
                        width: 80,
                        background: 'linear-gradient(-90deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
                        border: 'none',
                        opacity: 0,
                        transition: 'opacity 0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                />
            )}

            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
                {/* Blurry Background */}
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
                    objectFit: "contain",
                    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                    zIndex: 2,
                }}
                src={previewImage}
                />
            </div>
          </div>

          {/* Right: Info Sidebar */}
          {previewFile && (
            <div
              style={{
                width: isMobile ? "100%" : 360, // Slightly narrower
                background: imageMeta?.dominant 
                    ? `rgb(${imageMeta.dominant.r},${imageMeta.dominant.g},${imageMeta.dominant.b})` 
                    : "#222",
                color: "#fff",
                borderLeft: "none",
                display: isMobile ? "none" : "flex",
                flexDirection: "column",
                zIndex: 20,
                transition: "background 0.5s ease",
              }}
            >
              <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
                {/* Header Section */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <Title level={4} style={{ margin: 0, wordBreak: 'break-all', color: "#fff", fontSize: 18 }}>
                            {previewFile.filename}
                        </Title>
                        <Button
                            type="text"
                            icon={<EditOutlined style={{ color: "rgba(255,255,255,0.8)" }} />}
                            onClick={() => setIsEditingName(!isEditingName)}
                        />
                    </div>
                    
                    {isEditingName && (
                        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                            <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onPressEnter={() => {/* Trigger save logic */}}
                                style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none" }}
                            />
                            <Button type="primary" ghost onClick={async () => {
                                // Rename logic (reused)
                                const oldRel = previewFile.relPath;
                                const ext = previewFile.filename.includes(".") ? previewFile.filename.substring(previewFile.filename.lastIndexOf(".")) : "";
                                const newNameRaw = renameValue.trim();
                                if (!newNameRaw) return;
                                const hasExt = /\.[A-Za-z0-9]+$/.test(newNameRaw);
                                const newName = hasExt ? newNameRaw : `${newNameRaw}${ext}`;
                                try {
                                    setRenaming(true);
                                    const res = await api.put(`/images/${encodeURIComponent(oldRel)}`, { newName });
                                    if (res.data?.success) {
                                        const updated = res.data.data;
                                        setPreviewFile(updated);
                                        setPreviewTitle(updated.filename);
                                        setPreviewImage(updated.url);
                                        setImages(prev => prev.map(img => img.relPath === oldRel ? { ...img, ...updated } : img));
                                        setIsEditingName(false);
                                        message.success("重命名成功");
                                    }
                                } finally { setRenaming(false); }
                            }}>保存</Button>
                        </div>
                    )}

                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FolderOutlined style={{ color: "rgba(255,255,255,0.6)" }} />
                        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                            {dirValue || "根目录"}
                        </Text>
                        <Button type="link" size="small" onClick={() => setIsEditingDir(!isEditingDir)} style={{ padding: 0, height: 'auto', color: "rgba(255,255,255,0.8)" }}>
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
                                    style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none" }}
                                />
                             </div>
                             <Button type="primary" ghost size="small" onClick={async () => {
                                 // Dir change logic
                                 const oldRel = previewFile.relPath;
                                 try {
                                     const res = await api.put(`/images/${encodeURIComponent(oldRel)}`, { newDir: dirValue || "" });
                                     if (res.data?.success) {
                                         const updated = res.data.data;
                                         setPreviewFile(updated);
                                         setImages(prev => prev.map(img => img.relPath === oldRel ? { ...img, ...updated } : img));
                                         setIsEditingDir(false);
                                         message.success("目录已更新");
                                     }
                                 } catch (e) {}
                             }}>保存</Button>
                        </div>
                    )}
                </div>

                {/* Actions Row */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                    <Button block ghost icon={<DownloadOutlined />} onClick={() => handleDownload(previewFile)} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
                        下载
                    </Button>
                    <Popconfirm
                        title="确定删除?"
                        onConfirm={async () => {
                            const success = await handleDelete(previewFile.relPath);
                            if (success) setPreviewVisible(false);
                        }}
                        okText="是" cancelText="否"
                    >
                        <Button block danger ghost icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                </div>

                {/* Info Sections */}
                <Space direction="vertical" size={24} style={{ width: '100%' }}>
                    
                    {/* Basic Info */}
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: 'uppercase', marginBottom: 12 }}>
                            基本信息
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 }}>文件大小</div>
                                <div style={{ fontSize: 13, color: "#fff" }}>{formatFileSize(previewFile.size)}</div>
                            </div>
                            <div>
                                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 }}>格式</div>
                                <div style={{ fontSize: 13, color: "#fff" }}>{previewFile.filename.split('.').pop().toUpperCase()}</div>
                            </div>
                            {imageMeta && (
                                <>
                                    <div>
                                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 }}>分辨率</div>
                                        <div style={{ fontSize: 13, color: "#fff" }}>{imageMeta.width} × {imageMeta.height}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 }}>色彩空间</div>
                                        <div style={{ fontSize: 13, color: "#fff" }}>{imageMeta.space || '-'}</div>
                                    </div>
                                </>
                            )}
                            <div>
                                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 }}>上传时间</div>
                                <div style={{ fontSize: 13, color: "#fff" }}>{dayjs(previewFile.uploadTime).format("YYYY-MM-DD")}</div>
                            </div>
                        </div>
                    </div>

                    {/* EXIF Data */}
                    {imageMeta?.exif && (
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: 'uppercase', marginBottom: 12 }}>
                                拍摄参数
                            </div>
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <CameraOutlined style={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} />
                                    <div>
                                        <div style={{ fontSize: 13, color: "#fff" }}>{[imageMeta.exif.make, imageMeta.exif.model].filter(Boolean).join(" ")}</div>
                                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>相机</div>
                                    </div>
                                </div>
                                {imageMeta.exif.lensModel && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }}>◎</span>
                                        <div>
                                            <div style={{ fontSize: 13, color: "#fff" }}>{imageMeta.exif.lensModel}</div>
                                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>镜头</div>
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                                    {imageMeta.exif.fNumber && (
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>f/{imageMeta.exif.fNumber}</div>
                                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>光圈</div>
                                        </div>
                                    )}
                                    {imageMeta.exif.exposureTime && (
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{imageMeta.exif.exposureTime}s</div>
                                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>快门</div>
                                        </div>
                                    )}
                                    {imageMeta.exif.iso && (
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{imageMeta.exif.iso}</div>
                                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>ISO</div>
                                        </div>
                                    )}
                                </div>
                            </Space>
                        </div>
                    )}

                    {/* Colors - Simplified since background is the color */}
                </Space>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ImageGallery;
