import React, { useState, useEffect } from "react";
import {
  Upload,
  Button,
  message,
  Card,
  Typography,
  Space,
  Tag,
  Progress,
  Row,
  Col,
  Alert,
  theme,
  Grid,
} from "antd";
import { InboxOutlined, CheckCircleOutlined } from "@ant-design/icons";
import DirectorySelector from "./DirectorySelector";

const { Dragger } = Upload;
const { Title, Text } = Typography;

function sanitizeDir(input) {
  let dir = (input || "").trim().replace(/\\+/g, "/").replace(/\/+/g, "/");
  dir = dir.replace(/\/+$/, ""); // 去除末尾斜杠
  dir = dir.replace(/^\/+/, ""); // 去除开头斜杠
  dir = dir.replace(/\/+/, "/"); // 合并多余斜杠
  return dir;
}

const UploadComponent = ({ onUploadSuccess, api }) => {
  const {
    token: { colorBgContainer, colorBorder },
  } = theme.useToken();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dir, setDir] = useState("");
  const [config, setConfig] = useState({
    allowedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
    ],
    maxFileSize: 10 * 1024 * 1024,
    maxFileSizeMB: 10,
    allowedFormats: "JPG, JPEG, PNG, GIF, WEBP, BMP, SVG",
  });

  // 获取配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get("/config");
        if (response.data.success) {
          setConfig(response.data.data.upload);
        }
      } catch (error) {
        console.warn("获取配置失败，使用默认配置:", error);
      }
    };
    fetchConfig();
  }, [api]);

  const uploadProps = {
    name: "image",
    multiple: true,
    accept: config.allowedExtensions
      .map((ext) => `image/${ext.replace(".", "")}`)
      .join(","),
    beforeUpload: (file) => {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error("只能上传图片文件！");
        return false;
      }
      const isLtMax = file.size <= config.maxFileSize;
      if (!isLtMax) {
        message.error(`图片大小不能超过${config.maxFileSizeMB}MB！`);
        return false;
      }
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      let safeDir = sanitizeDir(dir);
      if (safeDir.includes("..")) {
        message.error("目录不能包含 .. 等非法字符");
        onError(new Error("目录不能包含 .. 等非法字符"));
        return;
      }
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();

      // 确保文件名编码正确，特别是中文文件名
      const fileName = file.name;
      formData.append("image", file, fileName);

      const url = safeDir
        ? `/upload?dir=${encodeURIComponent(safeDir)}`
        : "/upload";
      try {
        const response = await api.post(url, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        });
        if (response.data.success) {
          onSuccess(response.data);
          setUploadedFiles((prev) => [...prev, response.data.data]);
          message.success(`${fileName} 上传成功！`);
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        } else {
          message.error(response.data.error || "上传失败");
          onError(new Error(response.data.error));
        }
      } catch (error) {
        const msg = error?.response?.data?.error || error.message || "上传失败";
        message.error(msg);
        onError(new Error(msg));
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success("链接已复制到剪贴板");
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div>
      <Title level={isMobile ? 3 : 2}>上传图片</Title>

      <Space
        direction="vertical"
        style={{ width: "100%", marginBottom: isMobile ? 12 : 16 }}
        size={isMobile ? "small" : "middle"}
      >
        <DirectorySelector
          value={dir}
          onChange={setDir}
          placeholder="选择或输入子目录（如 2024/06/10 或 相册/家庭，可留空）"
          api={api}
        />
      </Space>

      <Card style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Dragger {...uploadProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传，严禁上传非图片文件
          </p>
          <p
            style={{
              fontSize: isMobile ? "11px" : "12px",
              color: "#999",
              marginTop: "8px",
              marginBottom: "0",
            }}
          >
            支持 {config.allowedFormats} 格式，单个文件最大{" "}
            {config.maxFileSizeMB}MB
          </p>
        </Dragger>

        {uploading && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={uploadProgress} status="active" />
            <Text type="secondary">正在上传...</Text>
          </div>
        )}
      </Card>

      {uploadedFiles.length > 0 && (
        <Card title="最近上传" style={{ marginTop: isMobile ? 16 : 24 }}>
          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
            {uploadedFiles
              .slice(-6)
              .reverse()
              .map((file, index) => (
                <Col xs={24} sm={12} md={8} lg={6} key={index}>
                  <Card
                    size="small"
                    hoverable
                    cover={
                      <img
                        alt={file.originalName}
                        src={file.url}
                        style={{
                          height: isMobile ? 100 : 120,
                          objectFit: "cover",
                        }}
                      />
                    }
                    actions={[
                      <Button
                        type="text"
                        icon={<CheckCircleOutlined />}
                        size={isMobile ? "small" : "middle"}
                        onClick={() =>
                          copyToClipboard(
                            `${window.location.origin}${file.url}`
                          )
                        }
                      >
                        {isMobile ? "复制" : "复制链接"}
                      </Button>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Text ellipsis style={{ maxWidth: "100%" }}>
                          {file.originalName}
                        </Text>
                      }
                      description={
                        <Space direction="vertical" size="small">
                          <Text
                            type="secondary"
                            style={{ fontSize: isMobile ? "11px" : "12px" }}
                          >
                            {formatFileSize(file.size)}
                          </Text>
                          <Tag
                            color="blue"
                            style={{ fontSize: isMobile ? "11px" : "12px" }}
                          >
                            {file.mimetype}
                          </Tag>
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
          </Row>
        </Card>
      )}
    </div>
  );
};

export default UploadComponent;
