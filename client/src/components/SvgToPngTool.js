import React, { useState, useRef } from "react";
import {
  Card,
  Typography,
  Space,
  Button,
  Input,
  message,
  Row,
  Col,
} from "antd";
import {
  CodeOutlined,
  PictureOutlined,
  DownloadOutlined,
  UploadOutlined,
  CopyOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { TextArea } = Input;
const { Title, Text } = Typography;

const SvgToPngTool = ({ onUploadSuccess }) => {
  const [svgCode, setSvgCode] = useState("");
  const [pngDataUrl, setPngDataUrl] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [fileName, setFileName] = useState("converted-image");
  const canvasRef = useRef(null);

  // 示例SVG代码
  const exampleSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="80" fill="#1890ff" stroke="#096dd9" stroke-width="3"/>
  <text x="100" y="110" text-anchor="middle" fill="white" font-size="16" font-family="Arial">SVG</text>
</svg>`;

  // 转换SVG为PNG
  const convertSvgToPng = async () => {
    if (!svgCode.trim()) {
      message.error("请输入SVG代码");
      return;
    }

    setIsConverting(true);
    try {
      // 创建SVG Blob
      const svgBlob = new Blob([svgCode], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // 创建Image对象
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");

          // 设置画布尺寸
          canvas.width = img.width;
          canvas.height = img.height;

          // 绘制图片到画布
          ctx.drawImage(img, 0, 0);

          // 转换为PNG
          const pngDataUrl = canvas.toDataURL("image/png");
          setPngDataUrl(pngDataUrl);

          // 清理URL
          URL.revokeObjectURL(svgUrl);
          message.success("SVG转换PNG成功！");
        } catch (error) {
          console.error("转换错误:", error);
          message.error("转换失败，请检查SVG代码格式");
        } finally {
          setIsConverting(false);
        }
      };

      img.onerror = () => {
        message.error("SVG代码格式错误，请检查代码");
        setIsConverting(false);
        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    } catch (error) {
      console.error("转换错误:", error);
      message.error("转换失败，请检查SVG代码");
      setIsConverting(false);
    }
  };

  // 下载PNG图片
  const downloadPng = () => {
    if (!pngDataUrl) {
      message.error("请先转换SVG为PNG");
      return;
    }

    const link = document.createElement("a");
    link.download = `${fileName}.png`;
    link.href = pngDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("PNG图片下载成功！");
  };

  // 上传PNG到图床
  const uploadToImageBed = async () => {
    if (!pngDataUrl) {
      message.error("请先转换SVG为PNG");
      return;
    }

    setIsUploading(true);
    try {
      // 将Data URL转换为Blob
      const response = await fetch(pngDataUrl);
      const blob = await response.blob();

      // 创建FormData
      const formData = new FormData();
      formData.append("image", blob, fileName + ".png");

      // 上传到服务器
      const uploadResponse = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (uploadResponse.data.success) {
        const imageUrl = `${window.location.origin}${uploadResponse.data.data.url}`;
        setUploadedUrl(imageUrl);
        message.success("PNG图片上传成功！");

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

  // 清空所有内容
  const clearAll = () => {
    setSvgCode("");
    setPngDataUrl("");
    setUploadedUrl("");
    setFileName("converted-image");
    message.success("已清空所有内容");
  };

  // 使用示例SVG
  const useExample = () => {
    setSvgCode(exampleSvg);
    setFileName("svg-example");
    message.success("已加载示例SVG代码");
  };

  // 自动生成文件名
  const generateFileName = () => {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "");
    const newFileName = `svg-${timestamp}`;
    setFileName(newFileName);
    message.success(`已生成文件名: ${newFileName}`);
  };

  return (
    <div>
      <Title level={2}>
        <CodeOutlined /> SVG转PNG工具
      </Title>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        {/* 左侧：SVG输入 */}
        <Col xs={24} lg={12}>
          <Card title="SVG代码输入" size="small">
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <div>
                <Button
                  type="dashed"
                  onClick={useExample}
                  icon={<CodeOutlined />}
                  style={{ marginBottom: 8 }}
                >
                  使用示例SVG
                </Button>
                <Button
                  type="text"
                  onClick={clearAll}
                  icon={<ClearOutlined />}
                  danger
                >
                  清空所有
                </Button>
              </div>

              <TextArea
                rows={12}
                placeholder="请输入SVG代码..."
                value={svgCode}
                onChange={(e) => setSvgCode(e.target.value)}
                style={{ fontFamily: "monospace" }}
              />

              <Button
                type="primary"
                onClick={convertSvgToPng}
                loading={isConverting}
                icon={<PictureOutlined />}
                block
              >
                {isConverting ? "转换中..." : "转换为PNG"}
              </Button>
            </Space>
          </Card>
        </Col>

        {/* 右侧：PNG预览和操作 */}
        <Col xs={24} lg={12}>
          <Card title="PNG预览" size="small">
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              {pngDataUrl ? (
                <>
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={pngDataUrl}
                      alt="转换后的PNG"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        border: "1px solid #d9d9d9",
                        borderRadius: "4px",
                      }}
                    />
                  </div>

                  <div>
                    <Text strong>文件名：</Text>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <Input
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="输入文件名（不含扩展名）"
                        addonAfter=".png"
                        style={{ flex: 1 }}
                      />
                      <Button
                        size="small"
                        onClick={generateFileName}
                        title="自动生成基于时间戳的文件名"
                      >
                        自动生成
                      </Button>
                    </div>
                  </div>

                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={downloadPng}>
                      下载PNG
                    </Button>
                    <Button
                      type="primary"
                      icon={<UploadOutlined />}
                      onClick={uploadToImageBed}
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
                    border: "2px dashed #d9d9d9",
                    borderRadius: "4px",
                  }}
                >
                  <PictureOutlined
                    style={{ fontSize: "48px", marginBottom: "16px" }}
                  />
                  <div>转换后的PNG图片将在这里显示</div>
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

      {/* 隐藏的Canvas用于转换 */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* 使用说明 */}
      <Card title="使用技巧" style={{ marginTop: 24 }} size="small">
        <Space direction="vertical">
          <div>
            <Text strong>支持的SVG特性：</Text>
            <ul>
              <li>基本图形：circle, rect, line, path, polygon等</li>
              <li>文本：text元素</li>
              <li>渐变：linearGradient, radialGradient</li>
              <li>滤镜：filter, feGaussianBlur等</li>
              <li>动画：animate, animateTransform等</li>
            </ul>
          </div>
          <div>
            <Text strong>文件名功能：</Text>
            <ul>
              <li>可以自定义上传和下载的文件名</li>
              <li>点击"自动生成"按钮生成基于时间戳的文件名</li>
              <li>文件名会自动添加.png扩展名</li>
              <li>使用示例SVG时会自动设置合适的文件名</li>
            </ul>
          </div>
          <div>
            <Text strong>注意事项：</Text>
            <ul>
              <li>确保SVG代码格式正确</li>
              <li>建议设置明确的width和height属性</li>
              <li>外部资源（如图片、字体）可能无法正常显示</li>
              <li>转换后的PNG质量取决于SVG的尺寸设置</li>
              <li>文件名不要包含特殊字符，避免上传失败</li>
            </ul>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default SvgToPngTool;
