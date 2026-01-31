import React, { useState, useEffect, useMemo, useRef } from "react";
import { Masonry, Spin, Typography, Empty, message, theme, Modal, Button, Grid, Space } from "antd";
import {
    EnvironmentOutlined, DownloadOutlined, LeftOutlined,
    RightOutlined, CameraOutlined,
    SunOutlined, MoonOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { thumbHashToDataURL } from "thumbhash";
import api from "../utils/api";
import ScrollingBackground from "./ScrollingBackground";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

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

const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const ImageItem = ({ image, hoverKey, setHoverKey, handlePreview, isMobile, handleDownload, copyToClipboard, thumbnailWidth = 0 }) => {
    const [loaded, setLoaded] = useState(false);
    const videoRef = useRef(null);
    const { token: { colorBgContainer } } = theme.useToken();

    useEffect(() => {
        if (!videoRef.current) return;
        const key = image.relPath || image.url || image.filename;

        if (hoverKey === key) {
            videoRef.current.currentTime = 0;
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { });
            }
        } else {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, [hoverKey, image]);

    return (
        <div
            style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "0px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                transition: "transform 0.3s ease",
                background: colorBgContainer,
                cursor: "zoom-in",
            }}
            onMouseEnter={() => setHoverKey(image.relPath || image.url || image.filename)}
            onMouseLeave={() => setHoverKey(null)}
            onClick={() => handlePreview(image)}
        >
            <div style={{ overflow: "hidden", position: "relative", background: "#f0f0f0" }}>
                {image.thumbhash && (
                    <div
                        style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            backgroundImage: `url(${getThumbHashUrl(image.thumbhash)})`,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            filter: 'blur(5px)', transform: 'scale(1.1)',
                            opacity: loaded ? 0 : 1, transition: "opacity 0.5s ease-out", zIndex: 1,
                        }}
                    />
                )}
                {(() => {
                    const isVideo = /\.(mp4|webm)$/i.test(image.filename);
                    if (isVideo) {
                        return (
                            <video
                                ref={videoRef}
                                src={image.url}
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                style={{
                                    width: "100%", height: "100%", display: "block", objectFit: "cover",
                                    transition: "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease-in",
                                    transform: hoverKey === (image.relPath || image.url || image.filename) ? "scale(1.05)" : "scale(1)",
                                    opacity: loaded ? 1 : 0, position: "relative", zIndex: 2,
                                }}
                                onLoadedData={() => setLoaded(true)}
                            />
                        );
                    }
                    return (
                        <img
                            alt={image.filename}
                            src={thumbnailWidth > 0 ? `${image.url}?w=${thumbnailWidth}` : image.url}
                            draggable={false}
                            loading="lazy"
                            onLoad={() => setLoaded(true)}
                            style={{
                                width: "100%", display: "block",
                                transition: "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease-in",
                                transform: hoverKey === (image.relPath || image.url || image.filename) ? "scale(1.05)" : "scale(1)",
                                opacity: loaded ? 1 : 0, position: "relative", zIndex: 2,
                            }}
                        />
                    );
                })()}
            </div>

            {!isMobile && (
                <div
                    style={{
                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)",
                        opacity: hoverKey === (image.relPath || image.url || image.filename) ? 1 : 0,
                        transition: "opacity 0.3s ease", zIndex: 10,
                        display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "20px", pointerEvents: "none",
                    }}
                >
                    <div style={{
                        transform: hoverKey === (image.relPath || image.url || image.filename) ? "translateY(0)" : "translateY(10px)",
                        transition: "transform 0.3s ease", pointerEvents: "auto",
                    }}>
                        <div style={{ color: "#fff", fontSize: "18px", fontWeight: 700, marginBottom: "4px", lineHeight: 1.2, textShadow: "0 2px 4px rgba(0,0,0,0.3)", wordBreak: "break-all" }}>
                            {image.filename.replace(/\.[^/.]+$/, "")}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.8)", fontSize: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                            <span>{dayjs(image.uploadTime).format("YYYY-MM-DD")}</span>
                            <span>·</span>
                            <span>{formatFileSize(image.size)}</span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <Button size="small" type="text" icon={<DownloadOutlined />} onClick={(e) => { e.stopPropagation(); handleDownload(image); }} style={{ color: "#fff", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", fontSize: "12px" }}>下载</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ModalVideoPlayer = ({ url, visible }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            if (visible) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => { });
            } else {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }
    }, [visible]);

    return (
        <video
            ref={videoRef}
            controls
            autoPlay
            src={url}
            style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.5)", zIndex: 2, outline: "none" }}
        />
    );
};

const ShareView = ({ currentTheme, onThemeChange }) => {
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [images, setImages] = useState([]);
    const [dirName, setDirName] = useState("");
    const [error, setError] = useState(null);
    const [hoverKey, setHoverKey] = useState(null);
    const [thumbnailWidth, setThumbnailWidth] = useState(0);

    // Fetch config
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await api.get("/config");
                if (response.data.success && response.data.data?.upload?.thumbnailWidth) {
                    setThumbnailWidth(response.data.data.upload.thumbnailWidth);
                }
            } catch (error) {
                console.warn("Failed to fetch config:", error);
            }
        };
        fetchConfig();
    }, []);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [hasMore, setHasMore] = useState(true);
    const loadMoreRef = useRef(null);

    // Modal State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(-1);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewLocation, setPreviewLocation] = useState("");
    const [imgLoaded, setImgLoaded] = useState(false);

    const { token: themeToken } = theme.useToken();
    const { colorBgContainer, colorText, colorTextSecondary } = themeToken;
    const screens = useBreakpoint();
    const isMobile = !screens.md;
    const isDarkMode = themeToken.theme?.id === 1 || colorBgContainer === "#141414";

    const fetchShare = React.useCallback(async (page = 1, append = false) => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (!token) {
            setError("无效的分享链接");
            setLoading(false);
            return;
        }

        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await api.get(`/share/access?token=${encodeURIComponent(token)}&page=${page}&pageSize=${pageSize}`);
            if (res.data.success) {
                setImages(prev => append ? prev.concat(res.data.data) : res.data.data);
                setDirName(res.data.dirName);

                const p = res.data.pagination;
                if (p) {
                    setHasMore(p.current < p.totalPages);
                } else {
                    setHasMore(false);
                }
            } else {
                let errorMsg = res.data.error || "获取分享内容失败";
                if (errorMsg.includes("Link already used") || errorMsg.includes("Burned")) {
                    errorMsg = "链接已失效 (阅后即焚)";
                } else if (errorMsg.includes("expired") || errorMsg.includes("Invalid")) {
                    errorMsg = "链接已过期";
                }
                if (!append) setError(errorMsg);
                else message.error(errorMsg);
            }
        } catch (e) {
            let errorMsg = e.response?.data?.error || "链接已失效或验证失败";
            if (errorMsg.includes("Link already used") || errorMsg.includes("Burned")) {
                errorMsg = "链接已失效 (阅后即焚)";
            } else if (errorMsg.includes("expired")) {
                errorMsg = "链接已过期";
            }
            if (!append) setError(errorMsg);
        } finally {
            if (append) {
                setLoadingMore(false);
            } else {
                setLoading(false);
            }
        }
    }, [pageSize]);

    useEffect(() => {
        fetchShare(1, false);
    }, [fetchShare]);

    useEffect(() => {
        if (currentPage > 1) {
            fetchShare(currentPage, true);
        }
    }, [currentPage, fetchShare]);

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

    const groups = useMemo(() => {
        const map = new Map();
        for (const img of images) {
            const key = dayjs(img.uploadTime).format("YYYY年MM月DD日");
            const arr = map.get(key) || [];
            arr.push(img);
            map.set(key, arr);
        }
        const dates = Array.from(map.keys()).sort(
            (a, b) => dayjs(b, "YYYY年MM月DD日").valueOf() - dayjs(a, "YYYY年MM月DD日").valueOf()
        );
        return dates.map((d) => ({ date: d, items: map.get(d) }));
    }, [images]);

    const handlePreview = React.useCallback((file) => {
        const index = images.findIndex(img => img.relPath === file.relPath);
        setPreviewIndex(index);
        setPreviewFile(file);
        setPreviewVisible(true);
        setPreviewLocation(""); // Reset location
        setImgLoaded(false);
    }, [images]);

    const showNext = React.useCallback(() => {
        if (previewIndex < images.length - 1) {
            handlePreview(images[previewIndex + 1]);
        }
    }, [previewIndex, images, handlePreview]);

    const showPrev = React.useCallback(() => {
        if (previewIndex > 0) {
            handlePreview(images[previewIndex - 1]);
        }
    }, [previewIndex, images, handlePreview]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!previewVisible) return;
            if (e.key === 'ArrowRight') showNext();
            if (e.key === 'ArrowLeft') showPrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewVisible, showNext, showPrev]);

    // Fetch Location for Preview
    useEffect(() => {
        if (!previewVisible || !previewFile?.exif?.latitude) {
            setPreviewLocation("");
            return;
        }

        const { latitude, longitude } = previewFile.exif;
        let active = true;

        const fetchPreviewLoc = async () => {
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=zh-CN`);
                const geoData = await geoRes.json();

                if (active && geoData) {
                    setPreviewLocation(geoData.display_name);
                }
            } catch (e) { }
        };

        fetchPreviewLoc();
        return () => { active = false; };
    }, [previewVisible, previewFile]);

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
            navigator.clipboard.writeText(text).then(() => message.success("链接已复制到剪贴板"));
        } else {
            // Fallback
            const input = document.createElement("input");
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
            message.success("链接已复制到剪贴板");
        }
    };

    if (loading) {
        return (
            <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Spin size="large" tip="正在验证分享链接..." />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: themeToken.colorBgLayout }}>
            {/* Header Banner */}
            <div style={{
                position: "relative",
                height: 300,
                overflow: "hidden",
                background: themeToken.colorBgContainer,
                marginBottom: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                {/* Theme Toggle Button */}
                <div style={{
                    position: "absolute",
                    top: 20,
                    right: 20,
                    zIndex: 100
                }}>
                    <Button
                        shape="circle"
                        icon={currentTheme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                        onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
                        style={{
                            background: currentTheme === 'dark' ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                            backdropFilter: "blur(4px)",
                            border: `1px solid ${currentTheme === 'dark' ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"}`,
                            color: currentTheme === 'dark' ? "#fff" : "rgba(0,0,0,0.85)"
                        }}
                    />
                </div>

                <ScrollingBackground usePicsum={true} />

                {/* Overlay Gradient */}
                <div style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: `linear-gradient(to bottom, 
                      ${isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)'} 0%, 
                      ${isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} 50%, 
                      ${themeToken.colorBgLayout} 100%)`,
                    zIndex: 1
                }} />

                {/* Header Content */}
                <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
                    <Title level={1} style={{ fontSize: 42, marginBottom: 8, letterSpacing: 1 }}>{dirName || "分享的相册"}</Title>
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 16 }}>共 {images.length} 张图片</Text>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1600, margin: "0 auto", padding: isMobile ? "0 12px" : "0 24px" }}>
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
                                color: colorTextSecondary,
                            }}
                        >
                            {group.date}
                        </div>

                        <Masonry
                            columns={isMobile ? 2 : screens.xl ? 5 : screens.lg ? 4 : screens.md ? 3 : 2}
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
                                    thumbnailWidth={thumbnailWidth}
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
            </div>

            {/* Full Screen Modal */}
            <Modal
                open={previewVisible}
                title={null}
                footer={null}
                onCancel={() => setPreviewVisible(false)}
                width="100vw"
                style={{ top: 0, margin: 0, maxWidth: "100vw", padding: 0 }}
                styles={{
                    body: { padding: 0, height: "100vh", overflow: "hidden", background: "#000" },
                    content: { padding: 0, background: "#000", boxShadow: "none" },
                    container: { padding: 0 }
                }}
                destroyOnClose
                closeIcon={null}
            >
                {previewFile && (
                    <div style={{ display: "flex", height: "100vh", position: "relative" }}>
                        {/* Close & Copy Buttons */}
                        <div style={{ position: "absolute", top: 20, right: isMobile ? 20 : 380, zIndex: 1000, display: "flex", gap: 12 }}>
                            <Button
                                shape="circle"
                                icon={<span style={{ fontSize: 24, lineHeight: 1 }}>×</span>}
                                onClick={() => setPreviewVisible(false)}
                                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", width: 40, height: 40 }}
                            />
                        </div>

                        {/* Left: Image Viewer */}
                        <div style={{ flex: 1, height: "100%", overflow: "hidden", position: "relative", backgroundColor: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {!isMobile && previewIndex > 0 && (
                                <Button
                                    type="text" icon={<LeftOutlined style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)' }} />}
                                    onClick={(e) => { e.stopPropagation(); showPrev(); }}
                                    style={{ position: 'absolute', left: 20, zIndex: 100, height: '100%', width: 80, background: 'linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 100%)', border: 'none', opacity: 0, transition: 'opacity 0.3s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                                />
                            )}
                            {!isMobile && previewIndex < images.length - 1 && (
                                <Button
                                    type="text" icon={<RightOutlined style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)' }} />}
                                    onClick={(e) => { e.stopPropagation(); showNext(); }}
                                    style={{ position: 'absolute', right: 20, zIndex: 100, height: '100%', width: 80, background: 'linear-gradient(-90deg, rgba(0,0,0,0.3) 0%, transparent 100%)', border: 'none', opacity: 0, transition: 'opacity 0.3s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                                />
                            )}

                            <div style={{ width: "100%", height: "100%", position: "relative", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundImage: `url(${previewFile.url})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(40px) brightness(0.5)", transform: "scale(1.2)", zIndex: 0 }} />
                                {/\.(mp4|webm)$/i.test(previewFile.filename) ? (
                                    <ModalVideoPlayer url={previewFile.url} visible={previewVisible} />
                                ) : (
                                    <>
                                        {!imgLoaded && (
                                            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 3 }}>
                                                <Spin size="large" />
                                            </div>
                                        )}
                                        <img
                                            key={previewFile.url}
                                            alt="preview"
                                            onLoad={() => setImgLoaded(true)}
                                            style={{
                                                maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain",
                                                boxShadow: "0 20px 50px rgba(0,0,0,0.5)", zIndex: 2,
                                                opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease"
                                            }}
                                            src={previewFile.url}
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right: Info Sidebar */}
                        {(() => {
                            const thumbUrl = getThumbHashUrl(previewFile.thumbhash);
                            const hasThumb = !!thumbUrl;

                            const textColor = hasThumb ? "#fff" : colorText;
                            const secondaryTextColor = hasThumb ? "rgba(255,255,255,0.75)" : colorTextSecondary;
                            const tertiaryTextColor = hasThumb ? "rgba(255,255,255,0.5)" : (isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)");

                            return (
                                <div style={{ width: isMobile ? "100%" : 360, background: hasThumb ? `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${thumbUrl}) center/cover no-repeat` : colorBgContainer, color: textColor, borderLeft: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "none", display: isMobile ? "none" : "flex", flexDirection: "column", zIndex: 20, transition: "background 0.3s ease, color 0.3s ease" }}>
                                    <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
                                        <div style={{ marginBottom: 24 }}>
                                            <Title level={4} style={{ margin: 0, wordBreak: 'break-all', color: textColor, fontSize: 18 }}>{previewFile.filename}</Title>
                                        </div>

                                        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                                            <Button block ghost icon={<DownloadOutlined />} onClick={() => handleDownload(previewFile)} style={{ color: textColor, borderColor: secondaryTextColor }}>下载</Button>
                                        </div>

                                        <Space direction="vertical" size={24} style={{ width: '100%' }}>
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: tertiaryTextColor, textTransform: 'uppercase', marginBottom: 12 }}>基本信息</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                    <div><div style={{ color: tertiaryTextColor, fontSize: 12, marginBottom: 2 }}>文件大小</div><div style={{ fontSize: 13, color: textColor }}>{formatFileSize(previewFile.size)}</div></div>
                                                    <div><div style={{ color: tertiaryTextColor, fontSize: 12, marginBottom: 2 }}>格式</div><div style={{ fontSize: 13, color: textColor }}>{previewFile.filename.split('.').pop().toUpperCase()}</div></div>
                                                    <div><div style={{ color: tertiaryTextColor, fontSize: 12, marginBottom: 2 }}>上传时间</div><div style={{ fontSize: 13, color: textColor }}>{dayjs(previewFile.uploadTime).format("YYYY-MM-DD")}</div></div>
                                                    {previewLocation && (
                                                        <div style={{ gridColumn: 'span 2' }}>
                                                            <div style={{ color: tertiaryTextColor, fontSize: 12, marginBottom: 2 }}>拍摄地点</div>
                                                            <div style={{ fontSize: 13, color: textColor, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}><EnvironmentOutlined /> {previewLocation}</div>
                                                            {previewFile.exif?.latitude && previewFile.exif?.longitude && (
                                                                <div style={{ position: "relative", height: 150, borderRadius: 8, overflow: "hidden", border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}` }}>
                                                                    <iframe
                                                                        title="Map Preview"
                                                                        width="100%"
                                                                        height="200"
                                                                        frameBorder="0"
                                                                        scrolling="no"
                                                                        marginHeight="0"
                                                                        marginWidth="0"
                                                                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${previewFile.exif.longitude - 0.01}%2C${previewFile.exif.latitude - 0.01}%2C${previewFile.exif.longitude + 0.01}%2C${previewFile.exif.latitude + 0.01}&layer=mapnik&marker=${previewFile.exif.latitude}%2C${previewFile.exif.longitude}`}
                                                                        style={{ border: 0 }}
                                                                    />
                                                                    <div style={{
                                                                        position: "absolute",
                                                                        bottom: 0,
                                                                        right: 0,
                                                                        background: "rgba(255, 255, 255, 0.7)",
                                                                        padding: "1px 4px",
                                                                        fontSize: "9px",
                                                                        color: "#000",
                                                                        pointerEvents: "none",
                                                                        borderTopLeftRadius: 4
                                                                    }}>
                                                                        © OSM
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {previewFile.exif && (
                                                <div>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: tertiaryTextColor, textTransform: 'uppercase', marginBottom: 12 }}>拍摄参数</div>
                                                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <CameraOutlined style={{ fontSize: 16, color: tertiaryTextColor }} />
                                                            <div><div style={{ fontSize: 13, color: textColor }}>{[previewFile.exif.make, previewFile.exif.model].filter(Boolean).join(" ")}</div><div style={{ fontSize: 12, color: tertiaryTextColor }}>相机</div></div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                                                            {previewFile.exif.fNumber && <div><div style={{ fontSize: 13, fontWeight: 500, color: textColor }}>f/{previewFile.exif.fNumber}</div><div style={{ fontSize: 12, color: tertiaryTextColor }}>光圈</div></div>}
                                                            {previewFile.exif.exposureTime && <div><div style={{ fontSize: 13, fontWeight: 500, color: textColor }}>{previewFile.exif.exposureTime}s</div><div style={{ fontSize: 12, color: tertiaryTextColor }}>快门</div></div>}
                                                            {previewFile.exif.iso && <div><div style={{ fontSize: 13, fontWeight: 500, color: textColor }}>{previewFile.exif.iso}</div><div style={{ fontSize: 12, color: tertiaryTextColor }}>ISO</div></div>}
                                                        </div>
                                                    </Space>
                                                </div>
                                            )}
                                        </Space>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )
                }
            </Modal >
        </div >
    );
};

export default ShareView;
