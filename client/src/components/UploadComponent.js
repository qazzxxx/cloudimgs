import React, { useState } from "react";
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
} from "antd";
import {
  InboxOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import LogoWithText from "./LogoWithText";
import axios from "axios";

const { Dragger } = Upload;
const { Title, Text } = Typography;

const UploadComponent = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const uploadProps = {
    name: "image",
    multiple: true,
    accept: "image/*",
    beforeUpload: (file) => {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error("只能上传图片文件！");
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error("图片大小不能超过10MB！");
        return false;
      }
      return true;
    },
    customRequest: async ({ file, onSuccess, onError, onProgress }) => {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("image", file);

      try {
        const response = await axios.post("/api/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
            onProgress({ percent: percentCompleted });
          },
        });

        if (response.data.success) {
          onSuccess(response.data);
          setUploadedFiles((prev) => [...prev, response.data.data]);
          message.success(`${file.name} 上传成功！`);
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        } else {
          onError(new Error(response.data.error));
        }
      } catch (error) {
        console.error("上传失败:", error);
        message.error(`${file.name} 上传失败！`);
        onError(error);
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

      <Alert
        message="上传说明"
        description="支持 JPG、PNG、GIF、WebP、BMP、SVG 格式，单个文件最大 10MB"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Dragger {...uploadProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传，严禁上传非图片文件
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
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text strong>上传图片：</Text>
            <Text code>POST /api/upload</Text>
          </div>
          <div>
            <Text strong>获取随机图片：</Text>
            <Text code>GET /api/random</Text>
          </div>
          <div>
            <Text strong>获取图片列表：</Text>
            <Text code>GET /api/images</Text>
          </div>
          <div>
            <Text strong>获取统计信息：</Text>
            <Text code>GET /api/stats</Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default UploadComponent;
