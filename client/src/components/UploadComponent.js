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
} from "antd";
import { InboxOutlined, CheckCircleOutlined } from "@ant-design/icons";
import DirectorySelector from "./DirectorySelector";
import axios from "axios";

const { Dragger } = Upload;
const { Title, Text } = Typography;

function sanitizeDir(input) {
  let dir = (input || "").trim().replace(/\\+/g, "/").replace(/\/+/g, "/");
  dir = dir.replace(/\/+$/, ""); // 去除末尾斜杠
  dir = dir.replace(/^\/+/, ""); // 去除开头斜杠
  dir = dir.replace(/\/+/, "/"); // 合并多余斜杠
  return dir;
}

const UploadComponent = ({ onUploadSuccess }) => {
  const {
    token: { colorBgContainer, colorText, colorBorder },
  } = theme.useToken();
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
        const response = await axios.get("/api/config");
        if (response.data.success) {
          setConfig(response.data.data.upload);
        }
      } catch (error) {
        console.warn("获取配置失败，使用默认配置:", error);
      }
    };
    fetchConfig();
  }, []);

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
        ? `/api/upload?dir=${encodeURIComponent(safeDir)}`
        : "/api/upload";
      try {
        const response = await axios.post(url, formData, {
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
      <Title level={2}>上传图片</Title>

      <Space
        direction="vertical"
        style={{ width: "100%", marginBottom: 16 }}
        size="middle"
      >
        <DirectorySelector
          value={dir}
          onChange={setDir}
          placeholder="选择或输入子目录（如 2024/06/10 或 相册/家庭，可留空）"
        />
      </Space>

      <Card>
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
              fontSize: "12px",
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
        <Card title="最近上传" style={{ marginTop: 24 }}>
          <Row gutter={[16, 16]}>
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
                        style={{ height: 120, objectFit: "cover" }}
                      />
                    }
                    actions={[
                      <Button
                        type="text"
                        icon={<CheckCircleOutlined />}
                        onClick={() =>
                          copyToClipboard(
                            `${window.location.origin}${file.url}`
                          )
                        }
                      >
                        复制链接
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
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            {formatFileSize(file.size)}
                          </Text>
                          <Tag color="blue">{file.mimetype}</Tag>
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
          </Row>
        </Card>
      )}

      <Card title="API 接口" style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Title level={4}>📤 上传图片</Title>
            <Text code>POST /api/upload</Text>
            <br />
            <Text strong>参数说明：</Text>
            <ul style={{ marginTop: 8 }}>
              <li>
                <Text code>image</Text> (必需): 图片文件，支持
                multipart/form-data
              </li>
              <li>
                <Text code>dir</Text> (可选): 子目录路径，如 "2024/06/10" 或
                "相册/家庭"
              </li>
            </ul>
            <Text strong>支持格式：</Text> JPG, PNG, GIF, WebP, BMP, SVG
            <br />
            <Text strong>文件大小限制：</Text> 最大 10MB
            <br />
            <Text strong>curl 示例：</Text>
            <div
              style={{
                backgroundColor: colorBgContainer,
                border: `1px solid ${colorBorder}`,
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                overflow: "auto",
                marginTop: "8px",
              }}
            >
              <Text code style={{ display: "block", marginBottom: "4px" }}>
                {`# 上传到根目录
curl -X POST http://localhost:3001/api/upload \\
  -F "image=@/path/to/your/image.jpg"`}
              </Text>
              <Text code style={{ display: "block", marginBottom: "4px" }}>
                {`# 上传到指定子目录
curl -X POST "http://localhost:3001/api/upload?dir=2024/06/10" \\
  -F "image=@/path/to/your/image.jpg"`}
              </Text>
              <Text code style={{ display: "block" }}>
                {`# 上传中文文件名图片
curl -X POST "http://localhost:3001/api/upload?dir=相册/家庭" \\
  -F "image=@/path/to/你的图片.jpg"`}
              </Text>
            </div>
            <Text strong>响应示例：</Text>
            <div
              style={{
                backgroundColor: colorBgContainer,
                border: `1px solid ${colorBorder}`,
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                overflow: "auto",
                marginTop: "8px",
              }}
            >
              <Text code>
                {`{
  "success": true,
  "message": "图片上传成功",
  "data": {
    "filename": "image.jpg",
    "originalName": "原始文件名.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg",
    "uploadTime": "2024-01-01T12:00:00.000Z",
    "url": "/api/images/image.jpg",
    "relPath": "image.jpg"
  }
}`}
              </Text>
            </div>
          </div>

          <div>
            <Title level={4}>📋 获取图片列表</Title>
            <Text code>GET /api/images</Text>
            <br />
            <Text strong>参数说明：</Text>
            <ul style={{ marginTop: 8 }}>
              <li>
                <Text code>dir</Text> (可选): 指定目录路径，如 "2024/06/10"
              </li>
            </ul>
            <Text strong>curl 示例：</Text>
            <div
              style={{
                backgroundColor: colorBgContainer,
                border: `1px solid ${colorBorder}`,
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                overflow: "auto",
                marginTop: "8px",
              }}
            >
              <Text code style={{ display: "block", marginBottom: "4px" }}>
                {`# 获取根目录所有图片
curl http://localhost:3001/api/images`}
              </Text>
              <Text code style={{ display: "block" }}>
                {`# 获取指定目录图片
curl "http://localhost:3001/api/images?dir=2024/06/10"`}
              </Text>
            </div>
          </div>

          <div>
            <Title level={4}>🎲 获取随机图片</Title>
            <Text code>GET /api/random</Text>
            <br />
            <Text strong>参数说明：</Text>
            <ul style={{ marginTop: 8 }}>
              <li>
                <Text code>dir</Text> (可选): 指定目录路径
              </li>
            </ul>
            <Text strong>curl 示例：</Text>
            <div
              style={{
                backgroundColor: colorBgContainer,
                border: `1px solid ${colorBorder}`,
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                overflow: "auto",
                marginTop: "8px",
              }}
            >
              <Text code style={{ display: "block", marginBottom: "4px" }}>
                {`# 获取根目录随机图片
curl http://localhost:3001/api/random`}
              </Text>
              <Text code style={{ display: "block" }}>
                {`# 获取指定目录随机图片
curl "http://localhost:3001/api/random?dir=2024/06/10"`}
              </Text>
            </div>
          </div>

          <div>
            <Title level={4}>📊 获取统计信息</Title>
            <Text code>GET /api/stats</Text>
            <br />
            <Text strong>参数说明：</Text>
            <ul style={{ marginTop: 8 }}>
              <li>
                <Text code>dir</Text> (可选): 指定目录路径
              </li>
            </ul>
            <Text strong>curl 示例：</Text>
            <div
              style={{
                backgroundColor: colorBgContainer,
                border: `1px solid ${colorBorder}`,
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                overflow: "auto",
                marginTop: "8px",
              }}
            >
              <Text code style={{ display: "block", marginBottom: "4px" }}>
                {`# 获取总体统计
curl http://localhost:3001/api/stats`}
              </Text>
              <Text code style={{ display: "block" }}>
                {`# 获取指定目录统计
curl "http://localhost:3001/api/stats?dir=2024/06/10"`}
              </Text>
            </div>
          </div>

          <div>
            <Title level={4}>📁 获取目录列表</Title>
            <Text code>GET /api/directories</Text>
            <br />
            <Text strong>参数说明：</Text>
            <ul style={{ marginTop: 8 }}>
              <li>
                <Text code>dir</Text> (可选): 指定父目录路径
              </li>
            </ul>
            <Text strong>curl 示例：</Text>
            <div
              style={{
                backgroundColor: colorBgContainer,
                border: `1px solid ${colorBorder}`,
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                overflow: "auto",
                marginTop: "8px",
              }}
            >
              <Text code style={{ display: "block", marginBottom: "4px" }}>
                {`# 获取根目录下的子目录
curl http://localhost:3001/api/directories`}
              </Text>
              <Text code style={{ display: "block" }}>
                {`# 获取指定目录下的子目录
curl "http://localhost:3001/api/directories?dir=2024"`}
              </Text>
            </div>
          </div>

          <div>
            <Title level={4}>🗑️ 删除图片</Title>
            <Text code>DELETE /api/images/{"{图片路径}"}</Text>
            <br />
            <Text strong>参数说明：</Text>
            <ul style={{ marginTop: 8 }}>
              <li>
                <Text code>图片路径</Text> (必需): 图片的相对路径，如
                "image.jpg" 或 "2024/06/10/image.jpg"
              </li>
            </ul>
            <Text strong>curl 示例：</Text>
            <div
              style={{
                backgroundColor: colorBgContainer,
                border: `1px solid ${colorBorder}`,
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                overflow: "auto",
                marginTop: "8px",
              }}
            >
              <Text code style={{ display: "block", marginBottom: "4px" }}>
                {`# 删除根目录图片
curl -X DELETE "http://localhost:3001/api/images/image.jpg"`}
              </Text>
              <Text code style={{ display: "block" }}>
                {`# 删除子目录图片
curl -X DELETE "http://localhost:3001/api/images/2024/06/10/image.jpg"`}
              </Text>
            </div>
          </div>

          <Alert
            message="注意事项"
            description="所有API都支持中文文件名和目录名，会自动进行URL编码处理。图片访问URL可以直接在浏览器中打开。"
            type="info"
            showIcon
          />
        </Space>
      </Card>
    </div>
  );
};

export default UploadComponent;
