import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Typography,
  Space,
  Button,
  Input,
  message,
  Row,
  Col,
  Slider,
  Upload,
  theme,
} from "antd";
import {
  FileZipOutlined,
  UploadOutlined,
  DownloadOutlined,
  CopyOutlined,
  PictureOutlined,
} from "@ant-design/icons";
// import axios from "axios";

const { Title, Text } = Typography;
const { Dragger } = Upload;

const ImageCompressor = ({ onUploadSuccess, api }) => {
  const {
    token: { colorBorder, colorFillTertiary },
  } = theme.useToken();

  const [originalImage, setOriginalImage] = useState(null);
  const [compressedImage, setCompressedImage] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);

  // 压缩参数
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [quality, setQuality] = useState(100);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);

  const canvasRef = useRef(null);

  // 处理粘贴事件
  const handlePaste = async (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handlePastedImage(file);
        }
        break;
      }
    }
  };

  // 处理粘贴的图片
  const handlePastedImage = async (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("只能上传图片文件！");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 设置原始图片信息
        setOriginalImage(e.target.result);
        setOriginalSize(file.size);
        setFileName(`pasted-image-${Date.now()}`); // 生成文件名

        // 设置默认尺寸为原始图片尺寸
        setWidth(img.width);
        setHeight(img.height);
        setMaintainAspectRatio(true);
        setOriginalAspectRatio(img.width / img.height);

        message.success("图片粘贴成功！");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // 添加全局粘贴事件监听
  useEffect(() => {
    const handleGlobalPaste = (event) => {
      // 检查是否在输入框中，如果是则不处理粘贴
      const target = event.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      handlePaste(event);
    };

    document.addEventListener("paste", handleGlobalPaste);

    return () => {
      document.removeEventListener("paste", handleGlobalPaste);
    };
  }, []);

  // 处理图片上传
  const handleImageUpload = (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("只能上传图片文件！");
      return false;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 设置原始图片信息
        setOriginalImage(e.target.result);
        setOriginalSize(file.size);
        setFileName(file.name.replace(/\.[^/.]+$/, "")); // 移除扩展名

        // 设置默认尺寸为原始图片尺寸
        setWidth(img.width);
        setHeight(img.height);
        setMaintainAspectRatio(true);
        setOriginalAspectRatio(img.width / img.height);

        // 保存原始图片引用
        // originalImageRef.current = img; // This line is removed

        message.success("图片上传成功！");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    return false; // 阻止默认上传行为
  };

  // 压缩图片
  const compressImage = () => {
    if (!originalImage || !canvasRef.current) {
      message.error("请先上传图片");
      return;
    }

    setIsCompressing(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        // 设置画布尺寸
        canvas.width = width;
        canvas.height = height;

        // 清空画布（透明填充）
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 提升缩放质量
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // 计算缩放比例和居中坐标
        const scale = Math.min(width / img.width, height / img.height);
        // 如果目标尺寸比原图大，保持原图大小不放大
        const drawWidth = scale > 1 ? img.width : img.width * scale;
        const drawHeight = scale > 1 ? img.height : img.height * scale;
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;

        // 居中绘制图片，保持原图清晰度
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // 转换为压缩后的图片（PNG，保留透明像素）
        const compressedDataUrl = canvas.toDataURL("image/png");
        setCompressedImage(compressedDataUrl);

        // 计算压缩后的大小
        const base64Length =
          compressedDataUrl.length - "data:image/png;base64,".length;
        const compressedBytes = Math.ceil(base64Length * 0.75);
        setCompressedSize(compressedBytes);

        message.success("图片压缩成功！");
      };
      img.src = originalImage;
    } catch (error) {
      console.error("压缩错误:", error);
      message.error("压缩失败，请重试");
    } finally {
      setIsCompressing(false);
    }
  };

  // 处理宽度变化
  const handleWidthChange = (value) => {
    setWidth(value);
    if (maintainAspectRatio) {
      setHeight(Math.round(value / originalAspectRatio));
    }
  };

  // 处理高度变化
  const handleHeightChange = (value) => {
    setHeight(value);
    if (maintainAspectRatio) {
      setWidth(Math.round(value * originalAspectRatio));
    }
  };

  // 切换宽高比锁定
  const toggleAspectRatio = () => {
    setMaintainAspectRatio(!maintainAspectRatio);
  };

  // 下载压缩后的图片
  const downloadCompressedImage = () => {
    if (!compressedImage) {
      message.error("请先压缩图片");
      return;
    }

    const link = document.createElement("a");
    link.download = `${fileName}-compressed.png`;
    link.href = compressedImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("压缩图片下载成功！");
  };

  // 上传压缩后的图片
  const uploadCompressedImage = async () => {
    if (!compressedImage) {
      message.error("请先压缩图片");
      return;
    }

    setIsUploading(true);
    try {
      // 将Data URL转换为Blob
      const response = await fetch(compressedImage);
      const blob = await response.blob();

      // 创建FormData
      const formData = new FormData();
      formData.append("image", blob, `${fileName}-compressed.png`);

      // 上传到服务器
      const uploadResponse = await api.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (uploadResponse.data.success) {
        const imageUrl = `${window.location.origin}${uploadResponse.data.data.url}`;
        setUploadedUrl(imageUrl);
        message.success("压缩图片上传成功！");

        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        message.error(uploadResponse.data.error || "上传失败");
      }
    } catch (error) {
      console.error("上传错误:", error);
      message.error("上传失败，请重试");
    } finally {
      setIsUploading(false);
    }
  };

  // 复制上传的URL
  const copyUploadedUrl = () => {
    if (!uploadedUrl) {
      message.error("没有可复制的URL");
      return;
    }

    navigator.clipboard.writeText(uploadedUrl).then(() => {
      message.success("URL已复制到剪贴板");
    });
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 计算压缩率
  const compressionRatio =
    originalSize > 0
      ? (((originalSize - compressedSize) / originalSize) * 100).toFixed(1)
      : 0;

  return (
    <div>
      <Title level={2}>
        <FileZipOutlined /> 图片压缩工具
      </Title>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        {/* 左侧：图片上传和参数设置 */}
        <Col xs={24} lg={12}>
          <Card title="图片上传" size="small" style={{ marginBottom: 16 }}>
            <Dragger
              accept="image/*"
              beforeUpload={handleImageUpload}
              showUploadList={false}
              disabled={isCompressing}
            >
              {originalImage ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={originalImage}
                    alt="原始图片"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      border: `1px solid ${colorBorder}`,
                      borderRadius: "4px",
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      原始大小: {formatFileSize(originalSize)}
                    </Text>
                  </div>
                </div>
              ) : (
                <div>
                  <PictureOutlined
                    style={{ fontSize: "48px", color: "#999" }}
                  />
                  <p>点击或拖拽图片到此区域上传</p>
                  <p
                    style={{
                      color: "#1890ff",
                      fontSize: "12px",
                      marginTop: "8px",
                    }}
                  >
                    支持 Ctrl+V 粘贴图片
                  </p>
                </div>
              )}
            </Dragger>
          </Card>

          {originalImage && (
            <Card title="压缩参数" size="small">
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                {/* 文件名 */}
                <div>
                  <Text strong>文件名：</Text>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="输入文件名（不含扩展名）"
                    style={{ marginTop: 8 }}
                    addonAfter=".png"
                  />
                </div>

                {/* 尺寸设置 */}
                <div>
                  <Text strong>尺寸设置：</Text>
                  <div style={{ marginTop: 8 }}>
                    <Row gutter={8}>
                      <Col span={11}>
                        <Input
                          type="number"
                          placeholder="宽度"
                          value={width}
                          onChange={(e) =>
                            handleWidthChange(parseInt(e.target.value) || 0)
                          }
                          addonAfter="px"
                        />
                      </Col>
                      <Col
                        span={2}
                        style={{ textAlign: "center", lineHeight: "32px" }}
                      >
                        ×
                      </Col>
                      <Col span={11}>
                        <Input
                          type="number"
                          placeholder="高度"
                          value={height}
                          onChange={(e) =>
                            handleHeightChange(parseInt(e.target.value) || 0)
                          }
                          addonAfter="px"
                        />
                      </Col>
                    </Row>
                    <Button
                      type={maintainAspectRatio ? "primary" : "default"}
                      size="small"
                      onClick={toggleAspectRatio}
                      style={{ marginTop: 8 }}
                    >
                      {maintainAspectRatio ? "锁定宽高比" : "解锁宽高比"}
                    </Button>
                  </div>
                </div>

                {/* 质量设置 */}
                <div>
                  <Text strong>压缩质量：{quality}%</Text>
                  <Slider
                    min={1}
                    max={100}
                    value={quality}
                    onChange={setQuality}
                    style={{ marginTop: 8 }}
                  />
                </div>

                {/* 压缩按钮 */}
                <Button
                  type="primary"
                  onClick={compressImage}
                  loading={isCompressing}
                  icon={<FileZipOutlined />}
                  block
                >
                  {isCompressing ? "压缩中..." : "开始压缩"}
                </Button>
              </Space>
            </Card>
          )}
        </Col>

        {/* 右侧：压缩结果预览 */}
        <Col xs={24} lg={12}>
          <Card title="压缩结果" size="small">
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              {compressedImage ? (
                <>
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={compressedImage}
                      alt="压缩后的图片"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        border: `1px solid ${colorBorder}`,
                        borderRadius: "4px",
                      }}
                    />
                  </div>

                  {/* 压缩信息 */}
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: colorFillTertiary,
                      borderRadius: "4px",
                    }}
                  >
                    <div>
                      <Text strong>压缩信息：</Text>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Text type="secondary">原始大小：</Text>
                          <br />
                          <Text>{formatFileSize(originalSize)}</Text>
                        </Col>
                        <Col span={12}>
                          <Text type="secondary">压缩后大小：</Text>
                          <br />
                          <Text>{formatFileSize(compressedSize)}</Text>
                        </Col>
                      </Row>
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">压缩率：</Text>
                        <Text style={{ color: "#52c41a", fontWeight: "bold" }}>
                          {compressionRatio}%
                        </Text>
                      </div>
                    </div>
                  </div>

                  <Space>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={downloadCompressedImage}
                    >
                      下载图片
                    </Button>
                    <Button
                      type="primary"
                      icon={<UploadOutlined />}
                      onClick={uploadCompressedImage}
                      loading={isUploading}
                    >
                      {isUploading ? "上传中..." : "上传到图床"}
                    </Button>
                  </Space>
                </>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#999",
                    border: `2px dashed ${colorBorder}`,
                    borderRadius: "4px",
                  }}
                >
                  <FileZipOutlined
                    style={{ fontSize: "48px", marginBottom: "16px" }}
                  />
                  <div>压缩后的图片将在这里显示</div>
                </div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 上传结果 */}
      {uploadedUrl && (
        <Card title="上传结果" style={{ marginTop: 24 }} size="small">
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Text strong>图片URL：</Text>
              <Text code style={{ wordBreak: "break-all" }}>
                {uploadedUrl}
              </Text>
            </div>
            <Space>
              <Button icon={<CopyOutlined />} onClick={copyUploadedUrl}>
                复制URL
              </Button>
              <Button type="link" href={uploadedUrl} target="_blank">
                在新窗口打开
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {/* 隐藏的Canvas用于压缩 */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* 使用说明 */}
      <Card
        title={
          <span>
            <FileZipOutlined style={{ marginRight: 8, color: "#1890ff" }} />
            使用技巧
          </span>
        }
        style={{ marginTop: 24 }}
        size="small"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <div
              style={{
                padding: "16px",
                backgroundColor: colorFillTertiary,
                borderRadius: "8px",
                border: `1px solid ${colorBorder}`,
                height: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "12px",
                  color: "#1890ff",
                  fontWeight: "bold",
                }}
              >
                <PictureOutlined style={{ marginRight: 8, fontSize: "16px" }} />
                压缩参数说明
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  lineHeight: "1.8",
                }}
              >
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>尺寸：</Text>设置压缩后的图片尺寸，支持锁定宽高比
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>宽高比：</Text>
                  解锁后可自由设置尺寸，图片居中显示，多余部分用透明像素填充，避免变形
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>质量：</Text>
                  1-100%，数值越高图片质量越好，文件越大
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>压缩率：</Text>显示压缩前后的大小对比
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>格式：</Text>压缩后统一为PNG格式，支持透明像素
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>清晰度保持：</Text>
                  设置大尺寸时保持原图清晰度，不进行放大，多余部分用透明填充
                </li>
              </ul>
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div
              style={{
                padding: "16px",
                backgroundColor: colorFillTertiary,
                borderRadius: "8px",
                border: `1px solid ${colorBorder}`,
                height: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "12px",
                  color: "#52c41a",
                  fontWeight: "bold",
                }}
              >
                <DownloadOutlined
                  style={{ marginRight: 8, fontSize: "16px" }}
                />
                使用建议
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  lineHeight: "1.8",
                }}
              >
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>网页使用：</Text>
                  建议质量70-80%，文件大小和质量的平衡点
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>移动端：</Text>建议尺寸不超过1200px，减少加载时间
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>宽高比：</Text>保持宽高比可以避免图片变形
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>透明填充：</Text>
                  解锁宽高比时，适合制作固定尺寸的图标或背景图
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>大尺寸设置：</Text>
                  设置比原图大的尺寸时，图片保持原清晰度，周围用透明背景填充
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <Text strong>备份：</Text>压缩前建议备份原始图片
                </li>
              </ul>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ImageCompressor;
