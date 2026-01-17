import React, { useState, useRef, useEffect } from "react";
import { Modal, Button, Input, message, Upload, Space, Tooltip, theme, Row, Col, Typography } from "antd";
import {
    InboxOutlined,
    PictureOutlined,
    DownloadOutlined,
    UploadOutlined,
    CodeOutlined,
    CloseOutlined,
    CopyOutlined,
    FileTextOutlined
} from "@ant-design/icons";

const { TextArea } = Input;
const { Text } = Typography;

const SvgToolModal = ({ visible, onClose, api }) => {
    const { token } = theme.useToken();
    const isDarkMode = token.colorBgContainer === "#141414" || token.colorBgContainer === "#000000" || token.colorBgContainer.includes("1f1f1f");

    const [svgCode, setSvgCode] = useState("");
    const [pngDataUrl, setPngDataUrl] = useState("");
    const [isConverting, setIsConverting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState("");
    const canvasRef = useRef(null);

    // Clear state when closing
    useEffect(() => {
        if (!visible) {
            // Optional: don't clear immediately to allow reopening
        }
    }, [visible]);

    const handlePaste = async (event) => {
        // If inside input/textarea, let default behavior happen
        if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
            return;
        }

        const items = event.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf("image") !== -1) {
                const file = item.getAsFile();
                if (file.type === "image/svg+xml") {
                    const reader = new FileReader();
                    reader.onload = (e) => setSvgCode(e.target.result);
                    reader.readAsText(file);
                    event.preventDefault();
                }
            } else if (item.type === "text/plain") {
                // If we are not focused on textarea, and pasted text looks like SVG
                if (document.activeElement.tagName !== 'TEXTAREA') {
                    item.getAsString((text) => {
                        if (text.trim().startsWith("<svg") || text.trim().startsWith("<?xml")) {
                            setSvgCode(text);
                            message.success("已粘贴 SVG 代码");
                        }
                    });
                }
            }
        }
    };

    // Listen for global paste when modal is open
    useEffect(() => {
        if (visible) {
            window.addEventListener('paste', handlePaste);
            return () => window.removeEventListener('paste', handlePaste);
        }
    }, [visible]);

    // Convert SVG to PNG
    useEffect(() => {
        if (!svgCode.trim()) {
            setPngDataUrl("");
            return;
        }

        const convert = () => {
            setIsConverting(true);
            const svgBlob = new Blob([svgCode], { type: "image/svg+xml" });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();

            img.onload = () => {
                const canvas = canvasRef.current;
                if (canvas) {
                    // Handle high DPI
                    const scale = 2; // Higher quality
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext("2d");
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, 0, 0);
                    setPngDataUrl(canvas.toDataURL("image/png"));
                }
                URL.revokeObjectURL(url);
                setIsConverting(false);
            };

            img.onerror = () => {
                setIsConverting(false);
                URL.revokeObjectURL(url);
            };

            img.src = url;
        };

        // Debounce conversion
        const timer = setTimeout(convert, 500);
        return () => clearTimeout(timer);
    }, [svgCode]);

    const handleUpload = async () => {
        if (!pngDataUrl) return;
        setIsUploading(true);
        try {
            const res = await fetch(pngDataUrl);
            const blob = await res.blob();
            const formData = new FormData();
            formData.append("image", blob, `svg-converted-${Date.now()}.png`);

            const uploadRes = await api.post("/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (uploadRes.data.success) {
                setUploadedUrl(`${window.location.origin}${uploadRes.data.data.url}`);
                message.success("上传成功");
            } else {
                message.error("上传失败");
            }
        } catch (e) {
            message.error("上传出错");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = () => {
        if (!pngDataUrl) return;
        const link = document.createElement("a");
        link.download = `svg-${Date.now()}.png`;
        link.href = pngDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const uploadProps = {
        accept: ".svg,image/svg+xml",
        showUploadList: false,
        beforeUpload: (file) => {
            const reader = new FileReader();
            reader.onload = (e) => setSvgCode(e.target.result);
            reader.readAsText(file);
            return false;
        }
    };

    // Glass styles
    const glassBg = isDarkMode ? "rgba(30, 30, 30, 0.75)" : "rgba(255, 255, 255, 0.75)";
    const glassBorder = isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.6)";
    const textColor = isDarkMode ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)";
    const secondaryTextColor = isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
    const sectionBorder = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            footer={null}
            width={900}
            centered
            destroyOnClose
            closeIcon={null}
            modalRender={(modal) => (
                <div style={{
                    background: glassBg,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderRadius: 24,
                    boxShadow: isDarkMode ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)" : "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
                    border: `1px solid ${glassBorder}`,
                    padding: 0,
                    overflow: 'hidden'
                }}>
                    {modal}
                </div>
            )}
            styles={{
                content: { background: 'transparent', padding: 0, boxShadow: 'none' },
                body: { padding: 0 },
                container: { padding: 0 }
            }}
        >
            <div style={{ display: 'flex', height: '600px', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: `1px solid ${sectionBorder}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: textColor }}>
                        <CodeOutlined style={{ color: token.colorPrimary }} /> SVG 转 PNG 工具
                    </div>
                    <Button
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={onClose}
                        style={{ color: secondaryTextColor }}
                    />
                </div>

                {/* Content Body */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Left: Input */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${sectionBorder}` }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <TextArea
                                value={svgCode}
                                onChange={(e) => setSvgCode(e.target.value)}
                                placeholder="在此处粘贴 SVG 代码..."
                                style={{
                                    height: '100%',
                                    resize: 'none',
                                    background: 'transparent',
                                    border: 'none',
                                    color: textColor,
                                    padding: '20px',
                                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                    fontSize: '13px',
                                    lineHeight: '1.5'
                                }}
                            />
                            {!svgCode && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none'
                                }}>
                                    <Upload {...uploadProps}>
                                        <div style={{
                                            pointerEvents: 'auto',
                                            textAlign: 'center',
                                            padding: '40px',
                                            borderRadius: 12,
                                            border: `2px dashed ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s'
                                        }}
                                            className="upload-area"
                                        >
                                            <p style={{ fontSize: 32, color: token.colorPrimary, marginBottom: 16 }}>
                                                <InboxOutlined />
                                            </p>
                                            <p style={{ color: textColor, marginBottom: 4 }}>点击或拖拽 SVG 文件</p>
                                            <p style={{ color: secondaryTextColor, fontSize: 12 }}>支持 .svg 文件或直接粘贴代码</p>
                                        </div>
                                    </Upload>
                                </div>
                            )}
                        </div>
                        {/* Toolbar for Input */}
                        <div style={{ padding: '12px 24px', borderTop: `1px solid ${sectionBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.02)" }}>
                            <Text style={{ fontSize: 12, color: secondaryTextColor }}>
                                {svgCode ? `${svgCode.length} 字符` : "等待输入..."}
                            </Text>
                            <Space>
                                <Upload {...uploadProps}>
                                    <Button size="small" icon={<FileTextOutlined />}>导入文件</Button>
                                </Upload>
                                {svgCode && (
                                    <Button size="small" danger type="text" onClick={() => { setSvgCode(""); setUploadedUrl(""); }}>清空</Button>
                                )}
                            </Space>
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: isDarkMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)" }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden', position: 'relative' }}>
                            {/* Checkerboard background */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
                                backgroundImage: `linear-gradient(45deg, ${isDarkMode ? '#333' : '#e0e0e0'} 25%, transparent 25%), linear-gradient(-45deg, ${isDarkMode ? '#333' : '#e0e0e0'} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${isDarkMode ? '#333' : '#e0e0e0'} 75%), linear-gradient(-45deg, transparent 75%, ${isDarkMode ? '#333' : '#e0e0e0'} 75%)`,
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                opacity: 0.1
                            }} />

                            {isConverting ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: token.colorPrimary }}>
                                    <div className="ant-spin ant-spin-spinning" style={{ marginBottom: 16 }}>
                                        <span className="ant-spin-dot ant-spin-dot-spin">
                                            <i className="ant-spin-dot-item"></i>
                                            <i className="ant-spin-dot-item"></i>
                                            <i className="ant-spin-dot-item"></i>
                                            <i className="ant-spin-dot-item"></i>
                                        </span>
                                    </div>
                                    <div>正在转换...</div>
                                </div>
                            ) : pngDataUrl ? (
                                <img
                                    src={pngDataUrl}
                                    alt="Preview"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        zIndex: 1,
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                                    }}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', color: secondaryTextColor }}>
                                    <PictureOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
                                    <div>预览区域</div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '24px', borderTop: `1px solid ${sectionBorder}`, display: 'flex', flexDirection: 'column', gap: 16, background: isDarkMode ? "rgba(0,0,0,0.2)" : "#fff" }}>
                            {uploadedUrl ? (
                                <div style={{
                                    background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    padding: '12px 16px',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    border: `1px solid ${token.colorBorder}`
                                }}>
                                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: token.colorText, fontSize: 13 }}>
                                        {uploadedUrl}
                                    </div>
                                    <Tooltip title="复制链接">
                                        <Button type="text" icon={<CopyOutlined />} size="small" onClick={() => {
                                            navigator.clipboard.writeText(uploadedUrl);
                                            message.success("已复制");
                                        }} />
                                    </Tooltip>
                                </div>
                            ) : (
                                <Row gutter={12}>
                                    <Col span={12}>
                                        <Button
                                            type="primary"
                                            block
                                            size="large"
                                            icon={<DownloadOutlined />}
                                            disabled={!pngDataUrl}
                                            onClick={handleDownload}
                                            style={{ height: 44 }}
                                        >
                                            下载 PNG
                                        </Button>
                                    </Col>
                                    <Col span={12}>
                                        <Button
                                            block
                                            size="large"
                                            icon={<UploadOutlined />}
                                            disabled={!pngDataUrl}
                                            loading={isUploading}
                                            onClick={handleUpload}
                                            style={{ height: 44 }}
                                        >
                                            上传图床
                                        </Button>
                                    </Col>
                                </Row>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hidden Canvas */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
        </Modal>
    );
};

export default SvgToolModal;
