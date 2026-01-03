import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Masonry,
  Button,
  Space,
  Typography,
  Modal,
  message,
  Popconfirm,
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
  FolderOutlined,
  MenuOutlined,
  ApiOutlined,
  CloudUploadOutlined,
  LeftOutlined,
  RightOutlined,
  CameraOutlined,
  EnvironmentOutlined,
  CodeOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { thumbHashToDataURL } from "thumbhash";
import DirectorySelector from "./DirectorySelector";
import SvgToolModal from "./SvgToolModal";
import AlbumManager from "./AlbumManager";
import ImageDetailModal from "./ImageDetailModal";
import ImageEditModal from "./ImageEditModal";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Search } = Input;

// Helper to convert base64 thumbhash to data URL
const getThumbHashUrl = (hash) => {
  if (!hash) return null;
  try {
    const binary = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
    return thumbHashToDataURL(binary);
  } catch (e) {
    console.error("ThumbHash decode error:", e);
    return null;
  }
};

const ImageItem = ({ 
    image, 
    hoverKey, 
    setHoverKey, 
    handlePreview, 
    formatFileSize, 
    isMobile, 
    handleDownload, 
    copyToClipboard, 
    handleDelete, 
    handleEdit,
    hoverLocation,
    isBatchMode,
    isSelected,
    onToggleSelect,
    registerRef
}) => {
    const [loaded, setLoaded] = useState(false);
    const {
        token: { colorBgContainer, colorPrimary },
    } = theme.useToken();

    return (
        <div
            ref={(node) => registerRef && registerRef(image.relPath, node)}
            style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "0px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                transition: "transform 0.3s ease",
                background: colorBgContainer,
                cursor: isBatchMode ? "default" : "zoom-in",
                transform: isBatchMode && isSelected ? "scale(0.95)" : "scale(1)",
            }}
            onMouseEnter={() =>
                !isBatchMode && setHoverKey(image.relPath || image.url || image.filename)
            }
            onMouseLeave={() => !isBatchMode && setHoverKey(null)}
            onClick={(e) => {
                if (isBatchMode) {
                    e.stopPropagation();
                    onToggleSelect && onToggleSelect(image.relPath);
                } else {
                    handlePreview(image);
                }
            }}
        >
            {/* Batch Selection Overlay */}
            {isBatchMode && (
                <>
                    <div style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 20,
                        pointerEvents: 'none', 
                    }}>
                        <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: '2px solid #fff',
                            background: isSelected ? colorPrimary : 'rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            transition: 'background 0.2s'
                        }}>
                            {isSelected && <CheckOutlined style={{ color: '#fff', fontSize: 14 }} />}
                        </div>
                    </div>
                    {isSelected && (
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            border: `4px solid ${colorPrimary}`,
                            zIndex: 15,
                            pointerEvents: "none",
                        }} />
                    )}
                </>
            )}

            <div
                style={{
                    overflow: "hidden",
                    position: "relative",
                    // Use a simple div for background placeholder
                    background: "#f0f0f0", 
                }}
            >
                {/* ThumbHash Placeholder Layer */}
                {image.thumbhash && (
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: `url(${getThumbHashUrl(image.thumbhash)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(5px)', // Optional: slight blur to smooth out artifacts
                            transform: 'scale(1.1)', // Prevent blur edges
                            opacity: loaded ? 0 : 1,
                            transition: "opacity 0.5s ease-out",
                            zIndex: 1,
                        }}
                    />
                )}

                {/* Real Image Layer */}
                <img
                    alt={image.filename}
                    src={image.url}
                    draggable={false}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                    style={{
                        width: "100%",
                        display: "block",
                        transition: "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease-in",
                        transform:
                            hoverKey ===
                            (image.relPath || image.url || image.filename)
                                ? "scale(1.05)"
                                : "scale(1)",
                        opacity: loaded ? 1 : 0, // Fade in when loaded
                        position: "relative",
                        zIndex: 2,
                    }}
                />
            </div>

            {/* Advanced Hover Overlay */}
            {!isMobile && !isBatchMode && (
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
                        zIndex: 10,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        padding: "20px",
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            transform:
                                hoverKey === (image.relPath || image.url || image.filename)
                                    ? "translateY(0)"
                                    : "translateY(10px)",
                            transition: "transform 0.3s ease",
                            pointerEvents: "auto",
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
                            {hoverLocation && (
                                <>
                                    <span>·</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <EnvironmentOutlined /> {hoverLocation}
                                    </span>
                                </>
                            )}
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
                            <Button
                                size="small"
                                type="text"
                                icon={<EditOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(image);
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
    );
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

const ImageGallery = ({ onDelete, onRefresh, api, isAuthenticated, refreshTrigger, isBatchMode = false, selectedItems = new Set(), onSelectionChange = () => {} }) => {
  const {
    token: { colorBgContainer, colorBorder, colorPrimary, colorTextSecondary, colorText },
  } = theme.useToken();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isDark = theme.useToken().theme?.id === 1 || colorBgContainer === "#141414";
  const isDarkMode = colorBgContainer === "#141414" || colorBgContainer === "#000000" || colorBgContainer === "#1f1f1f";

  // Helper to determine if a color is light or dark (returns true if light)
  const isLightColor = (r, g, b) => {
    // Calculate relative luminance using standard formula
    // Y = 0.2126R + 0.7152G + 0.0722B
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6; // Threshold for considering it "light"
  };

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
  const [hoverLocation, setHoverLocation] = useState("");
  const [svgToolVisible, setSvgToolVisible] = useState(false);
  const [albumManagerVisible, setAlbumManagerVisible] = useState(false);
  const [directoryRefreshKey, setDirectoryRefreshKey] = useState(0);

  // Album Password Logic
  const [albumPasswords, setAlbumPasswords] = useState({}); // { "dir": "password" }
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingDir, setPendingDir] = useState(null); // The directory that required password

  useEffect(() => {
    if (!hoverKey) {
        setHoverLocation("");
        return;
    }
    
    // Find image
    const img = images.find(i => (i.relPath || i.url || i.filename) === hoverKey);
    if (!img) return;

    // Debounce slightly or just fetch
    let active = true;
    
    const fetchLoc = async () => {
        try {
            // 1. Get Meta
            const res = await api.get(`/images/meta/${encodeURIComponent(img.relPath)}`);
            if (!active) return;
            
            if (res.data?.success && res.data.data?.exif?.latitude) {
                const { latitude, longitude } = res.data.data.exif;
                
                // 2. Reverse Geocode
                // Use a public API (Nominatim)
                // Note: In production, consider caching this or moving to backend
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=zh-CN`);
                const geoData = await geoRes.json();
                
                if (active && geoData) {
                    // Extract city/district
                    const addr = geoData.address;
                    // Try to find the most relevant "city" level name
                    const city = addr.city || addr.town || addr.county || addr.district || addr.state;
                    setHoverLocation(city ? `${city}` : (geoData.display_name ? geoData.display_name.split(',')[0] : "未知位置"));
                }
            }
        } catch (e) {
            // console.error(e); // Silent fail for location fetch
        }
    };

    // Delay to avoid spamming on fast scroll
    const timer = setTimeout(fetchLoc, 300);
    
    return () => {
        active = false;
        clearTimeout(timer);
    };
  }, [hoverKey, images, api]);

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
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const editorGetCurrentImgDataRef = useRef(null);

  // Drag Selection Logic
  const imageRefs = useRef(new Map());
  const [selectionBox, setSelectionBox] = useState(null);

  const registerRef = useCallback((id, node) => {
    if (node) {
      imageRefs.current.set(id, node);
    } else {
      imageRefs.current.delete(id);
    }
  }, []);

  const handleSelectionMouseDown = (e) => {
    if (!isBatchMode) return;
    if (e.button !== 0) return; // Only left click
    
    // Prevent text selection
    // document.body.style.userSelect = 'none'; // Done in effect
    
    setSelectionBox({
        startX: e.pageX,
        startY: e.pageY,
        currentX: e.pageX,
        currentY: e.pageY,
        isSelecting: true,
        initialSelection: new Set(selectedItems)
    });
  };

  useEffect(() => {
    if (!selectionBox?.isSelecting) return;

    document.body.style.userSelect = 'none';

    const handleSelectionMouseMove = (e) => {
        setSelectionBox(prev => ({
            ...prev,
            currentX: e.pageX,
            currentY: e.pageY
        }));
    };

    const handleSelectionMouseUp = (e) => {
        document.body.style.userSelect = '';
        setSelectionBox(null);
    };

    window.addEventListener('mousemove', handleSelectionMouseMove);
    window.addEventListener('mouseup', handleSelectionMouseUp);

    return () => {
        window.removeEventListener('mousemove', handleSelectionMouseMove);
        window.removeEventListener('mouseup', handleSelectionMouseUp);
        document.body.style.userSelect = '';
    };
  }, [selectionBox?.isSelecting]);

  // Real-time selection update
  useEffect(() => {
    if (!selectionBox?.isSelecting) return;

    const { startX, startY, currentX, currentY, initialSelection } = selectionBox;
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    if (width < 5 && height < 5) return;

    const animationFrame = requestAnimationFrame(() => {
        const newSelected = new Set(initialSelection);
        imageRefs.current.forEach((node, relPath) => {
            if (!node) return;
            const rect = node.getBoundingClientRect();
            const nodeLeft = rect.left + window.scrollX;
            const nodeTop = rect.top + window.scrollY;

            if (
                left < nodeLeft + rect.width &&
                left + width > nodeLeft &&
                top < nodeTop + rect.height &&
                top + height > nodeTop
            ) {
                newSelected.add(relPath);
            }
        });
        
        // Simple check to avoid unnecessary updates if size hasn't changed?
        // But Set content might change.
        onSelectionChange(newSelected);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [selectionBox?.currentX, selectionBox?.currentY]);

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

  const getEditorDefaults = useCallback((file) => {
    const filename = file?.filename || "image";
    const lastDot = filename.lastIndexOf(".");
    const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : "png";
    const normalizedExt = ext === "jpeg" ? "jpg" : ext;
    const type =
      normalizedExt === "jpg" || normalizedExt === "png" || normalizedExt === "webp"
        ? normalizedExt
        : "png";
    return { baseName, type };
  }, []);

  const handleEdit = useCallback((img) => {
    setEditorFile(img);
    setEditorVisible(true);
  }, []);

  const getDirFromRelPath = useCallback((relPath) => {
    if (!relPath) return "";
    const idx = relPath.lastIndexOf("/");
    return idx >= 0 ? relPath.slice(0, idx) : "";
  }, []);

  const splitFilename = useCallback((filename) => {
    const safe = filename || "image.png";
    const lastDot = safe.lastIndexOf(".");
    if (lastDot <= 0) return { baseName: safe, ext: "png" };
    return { baseName: safe.slice(0, lastDot), ext: safe.slice(lastDot + 1).toLowerCase() };
  }, []);

  const dataUrlToFile = useCallback((dataUrl, filename) => {
    const commaIndex = dataUrl.indexOf(",");
    const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : "";
    const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mimeType = mimeMatch?.[1] || "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mimeType });
  }, []);

  async function refreshAfterEdit(targetDir) {
    setCurrentPage(1);
    setHasMore(true);
    await fetchImages(targetDir, 1, pageSize, searchText, false);
  }

  const exportFromEditor = useCallback((name, extension) => {
    if (!editorGetCurrentImgDataRef.current) {
      throw new Error("编辑器未就绪");
    }
    const result = editorGetCurrentImgDataRef.current(
      { name, extension, quality: 92 },
      2,
      true
    );
    return result;
  }, []);

  const uploadEdited = useCallback(
    async ({ base64Image, targetDir, filename, overwrite }) => {
      const file = dataUrlToFile(base64Image, filename);
      const form = new FormData();
      form.append("image", file);
      const params = overwrite ? { dir: targetDir, overwrite: "true" } : { dir: targetDir };
      return api.post("/upload", form, { params });
    },
    [api, dataUrlToFile]
  );

  const handleOverwriteSave = useCallback(async () => {
    if (!editorFile) return;
    const { baseName, ext } = splitFilename(editorFile.filename);
    const targetDir = getDirFromRelPath(editorFile.relPath);

    setEditorSaving(true);
    let hideLoadingSpinner = null;
    try {
      const result = exportFromEditor(baseName, ext);
      hideLoadingSpinner = result.hideLoadingSpinner;
      const base64Image = result.imageData?.imageBase64;
      if (!base64Image) throw new Error("导出失败");

      const res = await uploadEdited({
        base64Image,
        targetDir,
        filename: editorFile.filename,
        overwrite: true,
      });

      if (res.data?.success) {
        message.success("已覆盖保存");
        setEditorVisible(false);
        setEditorFile(null);
        await refreshAfterEdit(targetDir);
      } else {
        message.error(res.data?.error || "保存失败");
      }
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || "保存失败");
    } finally {
      try {
        hideLoadingSpinner && hideLoadingSpinner();
      } catch (e) {}
      setEditorSaving(false);
    }
  }, [editorFile, exportFromEditor, getDirFromRelPath, refreshAfterEdit, splitFilename, uploadEdited]);

  const handleSaveAs = useCallback(() => {
    if (!editorFile) return;
    const { baseName, ext } = splitFilename(editorFile.filename);
    const targetDir = getDirFromRelPath(editorFile.relPath);
    let nextName = `${baseName}-edited.${ext}`;

    Modal.confirm({
      title: "另存为上传",
      content: (
        <Input
          defaultValue={nextName}
          onChange={(e) => {
            nextName = e.target.value;
          }}
          onPressEnter={() => {}}
          autoFocus
        />
      ),
      okText: "上传",
      cancelText: "取消",
      centered: true,
      onOk: async () => {
        const raw = (nextName || "").trim();
        if (!raw) {
          message.error("请输入文件名");
          throw new Error("invalid");
        }

        const parts = splitFilename(raw);
        setEditorSaving(true);
        let hideLoadingSpinner = null;
        try {
          const result = exportFromEditor(parts.baseName, parts.ext);
          hideLoadingSpinner = result.hideLoadingSpinner;
          const base64Image = result.imageData?.imageBase64;
          if (!base64Image) throw new Error("导出失败");

          const res = await uploadEdited({
            base64Image,
            targetDir,
            filename: raw,
            overwrite: false,
          });

          if (res.data?.success) {
            message.success("已上传");
            setEditorVisible(false);
            setEditorFile(null);
            await refreshAfterEdit(targetDir);
          } else {
            message.error(res.data?.error || "上传失败");
            throw new Error("failed");
          }
        } catch (e) {
          message.error(e?.response?.data?.error || e?.message || "上传失败");
          throw e;
        } finally {
          try {
            hideLoadingSpinner && hideLoadingSpinner();
          } catch (e) {}
          setEditorSaving(false);
        }
      },
    });
  }, [editorFile, exportFromEditor, getDirFromRelPath, refreshAfterEdit, splitFilename, uploadEdited]);

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

  async function fetchImages(
    targetDir = dir,
    targetPage = currentPage,
    targetPageSize = pageSize,
    targetSearch = searchText,
    append = false
  ) {
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
      
      const headers = {};
      if (targetDir && albumPasswords[targetDir]) {
          headers["x-album-password"] = albumPasswords[targetDir];
      }

      const res = await api.get("/images", { params, headers });
      if (res.data.success) {
        setImages((prev) => (append ? prev.concat(res.data.data) : res.data.data));
        setPagination(res.data.pagination);
        const p = res.data.pagination;
        setHasMore(p.current < p.totalPages);
      }
    } catch (e) {
        if (e.response && e.response.status === 403 && e.response.data?.locked) {
            // Album is locked
            setPendingDir(targetDir);
            // Do NOT clear passwordInput here to avoid clearing user input if multiple requests fail (race condition)
            // It is already cleared when dir changes.
            setPasswordPromptVisible(true);
            setLoading(false); // Stop loading spinner
            return;
        }
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
  }

  // 使用ref来跟踪是否是首次加载和防抖
  const isInitialized = useRef(false);
  const searchTimerRef = useRef(null);

  // 统一的数据获取逻辑
  useEffect(() => {
    // Clear password when dir changes to force re-entry if navigating back
    // But we need to be careful not to clear if we are just searching in the same dir?
    // User requirement: "每次都需要让输入子密码" (Every time need to enter password).
    // This implies if I leave a locked folder and come back, I need to enter password again.
    // So clearing all passwords (or at least for this dir?) when `dir` changes is correct.
    // However, if we clear ALL passwords, it's safer.
    
    // We only want to clear passwords if the directory ACTUALLY changed.
    // This effect runs on [dir, pageSize, searchText, isAuthenticated, refreshTrigger].
    // We need to track previous dir.
    
    // Actually, simply clearing `albumPasswords` here might cause infinite loops if fetchImages depends on it?
    // fetchImages reads `albumPasswords` from state closure.
    
    // Let's implement a dedicated effect for `dir` change to clear passwords.
  }, [dir]); // Dummy placeholder, real logic below

  // Track previous directory to detect changes
  const prevDirRef = useRef(dir);
  
  useEffect(() => {
      if (prevDirRef.current !== dir) {
          // Directory changed!
          // Clear all stored passwords to enforce re-entry
          setAlbumPasswords({});
          prevDirRef.current = dir;
          
          // Clear input and state to prevent race conditions
          setPasswordInput(""); 
          setImages([]); 
          setHasMore(true);
          setCurrentPage(1);
          setPendingDir(null);
      }
  }, [dir]);

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
  }, [dir, pageSize, searchText, isAuthenticated, refreshTrigger]);

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

  const [previewLocation, setPreviewLocation] = useState("");

  // Effect for fetching address in Preview Modal
  useEffect(() => {
    if (!previewVisible || !imageMeta?.exif?.latitude) {
        setPreviewLocation("");
        return;
    }

    const { latitude, longitude } = imageMeta.exif;
    let active = true;

    const fetchPreviewLoc = async () => {
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=zh-CN`);
            const geoData = await geoRes.json();
            
            if (active && geoData) {
                const addr = geoData.address;
                // Construct detailed address: Province + City + District + Street + Name
                // Example: 山东省 临沂市 兰山区 xx路 xx号
                const parts = [];
                if (addr.province) parts.push(addr.province);
                if (addr.city && addr.city !== addr.province) parts.push(addr.city);
                if (addr.district || addr.county) parts.push(addr.district || addr.county);
                if (addr.road || addr.street || addr.pedestrian) parts.push(addr.road || addr.street || addr.pedestrian);
                if (addr.house_number) parts.push(addr.house_number);
                
                // If specific name exists (amenity, building, etc.), append it
                const name = geoData.display_name.split(',')[0];
                if (name && !parts.includes(name)) {
                    // Sometimes name is just street number or road, check if redundant
                    parts.push(name);
                }

                // If parts is empty or too short, fallback to display_name or city
                let fullAddr = parts.join(" ");
                
                // Fallback logic
                if (!fullAddr) {
                     fullAddr = geoData.display_name;
                }
                
                setPreviewLocation(fullAddr);
            }
        } catch (e) {
            // console.error(e);
        }
    };

    fetchPreviewLoc();
    
    return () => { active = false; };
  }, [previewVisible, imageMeta]);

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
        } else {
             message.error(res.data?.error || "上传失败");
        }
    } catch (error) {
        console.error("Upload error:", error);
        message.error("上传出错");
    } finally {
        setUploading(false);
        setIsDragOver(false);
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
              setIsDragOver(true);
          }
      };

      const handleDragLeave = (e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounter--;
          if (dragCounter === 0) {
              setIsDragOver(false);
          }
      };

      const handleDragOver = (e) => {
          e.preventDefault();
          e.stopPropagation();
      };

      const handleDrop = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
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

  const handleUpdate = (updatedFile) => {
      setImages(prev => prev.map(img => img.relPath === previewFile.relPath ? { ...img, ...updatedFile } : img));
      setPreviewFile(updatedFile);
      setPreviewTitle(updatedFile.filename);
      setPreviewImage(updatedFile.url);
  };

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

  const handlePasswordSubmit = () => {
      if (!pendingDir) return;
      
      // Store password in a temporary session-like way? 
      // User requested "每次都需要让输入子密码" (Every time need to enter password).
      // So we should NOT store it in state persistently for auto-retry on subsequent navigations?
      // Wait, if we don't store it, scrolling/pagination will fail because loadMore calls fetchImages which needs password.
      // So we MUST store it at least for the current session while viewing this album.
      // But if user navigates away and comes back, they should enter it again.
      // Currently `albumPasswords` is state, so it persists as long as ImageGallery is mounted.
      // If user switches dir via top menu, `dir` changes.
      // If they switch back to locked dir, we check `albumPasswords[dir]`.
      // To satisfy "Every time need to enter password", we should CLEAR the password when directory changes.
      
      // We will implement clearing logic in the `dir` change effect.
      
      // Store password
      setAlbumPasswords(prev => ({
          ...prev,
          [pendingDir]: passwordInput
      }));
      
      // Close modal
      setPasswordPromptVisible(false);

      setLoading(true);
      const params = {
        page: 1,
        pageSize: pageSize,
        dir: pendingDir,
        search: searchText
      };
      const headers = { "x-album-password": passwordInput };
      
      api.get("/images", { params, headers })
         .then(res => {
             if (res.data.success) {
                 setImages(res.data.data);
                 setPagination(res.data.pagination);
                 setHasMore(res.data.pagination.current < res.data.pagination.totalPages);
             }
         })
         .catch(e => {
             message.error("密码错误或访问失败");
             // Clear invalid password
             setAlbumPasswords(prev => {
                 const next = { ...prev };
                 delete next[pendingDir];
                 return next;
             });
             setPasswordPromptVisible(true);
         })
         .finally(() => setLoading(false));
  };

  return (
    <div 
        style={{ padding: isMobile ? "12px" : "24px", minHeight: "100vh" }}
        onMouseDown={handleSelectionMouseDown}
    >
      {/* Drag Selection Box */}
      {selectionBox?.isSelecting && (
          <div
            style={{
                position: 'absolute',
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY),
                border: `1px solid ${colorPrimary}`,
                background: `${colorPrimary}33`, // 20% opacity
                zIndex: 9999,
                pointerEvents: 'none'
            }}
          />
      )}

      {/* Drag & Drop Overlay */}
      {isDragOver && (
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
              allowInput={true}
              api={api}
              bordered={false}
              size="middle"
              refreshKey={directoryRefreshKey}
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
              <div style={{ padding: 4 }}>
                  <Button
                    type="text"
                    icon={<FolderOutlined />}
                    onClick={() => setAlbumManagerVisible(true)}
                    style={{ 
                        width: "100%", 
                        textAlign: "left", 
                        display: "flex", 
                        alignItems: "center",
                        height: 40,
                        fontSize: 14
                    }}
                  >
                    相册管理
                  </Button>
                  <Button
                    type="text"
                    icon={<CodeOutlined />}
                    onClick={() => setSvgToolVisible(true)}
                    style={{ 
                        width: "100%", 
                        textAlign: "left", 
                        display: "flex", 
                        alignItems: "center",
                        height: 40,
                        fontSize: 14
                    }}
                  >
                    SVG 工具
                  </Button>
                  <Button
                    type="text"
                    icon={<ApiOutlined />}
                    onClick={() => window.open("/opendocs", "_blank")}
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
              
              {/* Masonry Layout - with batch selection support */}
              <Masonry
                columns={
                  isMobile ? 2 : screens.xl ? 5 : screens.lg ? 4 : screens.md ? 3 : 2
                }
                gutter={8}
                items={group.items.map((imgItem, index) => ({
                  key: imgItem.relPath || `item-${group.date}-${index}`,
                  data: imgItem,
                }))}
                itemRender={({ data: imgItem }) => (
                  <ImageItem
                    image={imgItem}
                    hoverKey={hoverKey}
                    setHoverKey={setHoverKey}
                    handlePreview={handlePreview}
                    formatFileSize={formatFileSize}
                    isMobile={isMobile}
                    handleDownload={handleDownload}
                    copyToClipboard={copyToClipboard}
                    handleDelete={handleDelete}
                    handleEdit={handleEdit}
                    hoverLocation={hoverLocation}
                    isBatchMode={isBatchMode}
                    isSelected={selectedItems.has(imgItem.relPath)}
                    onToggleSelect={(id) => {
                        const newSet = new Set(selectedItems);
                        if (newSet.has(id)) newSet.delete(id);
                        else newSet.add(id);
                        onSelectionChange(newSet);
                    }}
                    registerRef={registerRef}
                  />
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

      <ImageDetailModal
        visible={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          setIsEditingName(false);
        }}
        file={previewFile}
        api={api}
        onNext={showNext}
        onPrev={showPrev}
        hasNext={previewIndex < images.length - 1}
        hasPrev={previewIndex > 0}
        onDelete={(relPath) => {
            handleDelete(relPath);
            setPreviewVisible(false);
        }}
        onUpdate={handleUpdate}
      />
      <ImageEditModal
        open={editorVisible}
        file={editorFile}
        editorSaving={editorSaving}
        onCancel={() => {
          setEditorVisible(false);
          setEditorFile(null);
        }}
        onClose={() => {
          setEditorVisible(false);
          setEditorFile(null);
        }}
        onOverwriteSave={handleOverwriteSave}
        onSaveAs={handleSaveAs}
        getEditorDefaults={getEditorDefaults}
        getCurrentImgDataFnRef={editorGetCurrentImgDataRef}
        theme={isDarkMode ? "dark" : "light"}
      />
      <SvgToolModal visible={svgToolVisible} onClose={() => setSvgToolVisible(false)} api={api} />
      <AlbumManager 
        visible={albumManagerVisible} 
        onClose={() => {
            setAlbumManagerVisible(false);
            setDirectoryRefreshKey(prev => prev + 1);
        }} 
        api={api}
        onSelectAlbum={(path) => setDir(path)}
      />

      {/* Album Password Prompt Modal */}
      <Modal
        open={passwordPromptVisible}
        title="请输入相册密码"
        onOk={handlePasswordSubmit}
        onCancel={() => {
            setPasswordPromptVisible(false);
            setDir(""); // Go back to root or previous? Root is safer.
        }}
        okText="确认"
        cancelText="取消"
        centered
        closable={false}
        maskClosable={false}
        width={360}
      >
          <div style={{ marginBottom: 20 }}>该相册受密码保护，请输入密码以访问。</div>
          <Input.Password
            size="large"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            placeholder="输入密码"
            onPressEnter={handlePasswordSubmit}
            autoFocus
            style={{ height: 48, fontSize: 16 }}
          />
      </Modal>

    </div>
  );
};

export default ImageGallery;
